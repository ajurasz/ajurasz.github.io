---
title: "Micronaut, Testcontainers and Spock"
date: "2019-08-25"
tags: [micronaut, testcontainers, spock]
---

Before adopting a new framework I always verify does it provide decent testing support. If you follow `SOLID` principles then to test your business logic you just need a test framework like `JUnit` or `Spock`. Things get complicated when we want to test our code on integration level where business logic and infrastructure code are glue together and check if they behave correctly. This post focuses on writing 
integration tests (IT) for `Micronaut` application.

<!-- end -->

[Micronaut](https://micronaut.io/index.html) is a new kid on the block as its first GA release was less than a year ago on October 23, 2018. It has a lot of interesting features about which you can read in their official [documentation](https://docs.micronaut.io/latest/guide/index.html) but for this post, I will mention just one. It has blazing-fast startup time thanks to ahead of time compilation - I will explain later why this is important in case of ITs.

When writing integration tests your application will probably require some third-party services to work. In most cases, this will be a database. And to be honest, nowadays this requirement can be easily achieved with the help of different CI vendors. Following is the sample configuration of the two most popular CI platforms where we mark what additional services are required for our build process:

`Travis CI`

```yml
# travis.yml

services:
  - mysql 
```

`CircleCI`

```
version: 2
jobs:
  build:
    docker:
      - image: circleci/openjdk:8-jdk
      - image: mysql

    steps:
      - setup_remote_docker
```

But what if we want to run IT locally - then we need to start required docker containers before execution. I know that people often tend to use in-memory replacements for differents services but in my mind, IT
should be as close as possible to the target environment. But there is a better solution than manually taking care of running all required containers - [Testcontainers](https://www.testcontainers.org/) is a library that allows us to easily manage docker infrastructure from our test code. 

## Base structure

If it comes to testing `Micronaut` and `Testcontainers` each has handy annotation which brings their functionality to life. 

### Micronaut

For `Micronaut` this is a `@MicronautTest` which starts your real application same way as you would run `java -jar ...` command. Usually, you would create some base class with all required configuration
and then inherit it from your IT cases. Something like this:

```groovy
// IntegrationSpecificationBase.groovy

@MicronautTest(environments = "it")
abstract class IntegrationSpecificationBase extends Specification implements TestPropertyProvider {
    @Override
    Map<String, String> getProperties() {
        []
    }
}

// TodoControllerSpec.groovy
class TodoControllerSpec extends IntegrationSpecification {
    def "should get all todos"() {
        // test body
    }
}
```

This setup revels one potential problem. Potential because it does not have to be a problem for every case due to the main feature of the framework mentioned at the beginning - fast startup time. 
Problem is with the way how `MicronautTest` annotation is bound to test execution lifecycle - `Micronaut` application is built and started in `setupSpec`. Tear down happen in `cleanupSpec`. So
in the above example, `Micronaut` application will be started/stopped twice. This can be fixed simply by not using `@MicronautTest` annotation, i.e.:

```groovy
abstract class IntegrationSpecificationBase extends Specification implements TestPropertyProvider {
    @AutoCleanup
    private static EmbeddedServer embeddedServer = ApplicationContext.run(
            EmbeddedServer,
            [] as Map<String, Object>,
            "it")
}

```

Which approach you will choose should mostly be dictated by how long it takes for your application to start. Although `Micronaut` is fast, other libraries that you use doesn't need to be as fast (e.g. `micronaut-hibernate-jpa`).

### Testcontainers

`@Testcontainers` annotation similarly to `@MicronautTest` is bound to the same lifecycle phases. Unfortunately, right now there is no way of defining processing order - [change request](https://github.com/spockframework/spock/issues/646) was already proposed on github. Because of this, I don't see the possibility to use these two annotations together. Our desired behaviour would
be to start all required docker containers before starting `Micronaut` application. This could be achieved in two ways.

1. Spock global extension

A global extension can be used to execute some code at the very start and the very end of `Spock` execution. There are three steps needed to create such an extension:

1) Create `META-INF/services/org.spockframework.runtime.extension.IGlobalExtension` file
2) Create a class that implements `IGlobalExtension` interface
3) Add fully-qualified class name created in step `2` to file created in step `1`

Following example shows how to start all defined containers by using global extension:

```groovy
class DockerInfrastructureRunner extends AbstractGlobalExtension {
    private final Collection<GenericContainer> containers = [
            MySqlContainer.MY_SQL_CONTAINER
    ]

    @Override
    void start() {
        containers.each {
            if (!it.isRunning()) {
                it.start()
            }
        }
    }

    @Override
    void stop() {
        containers.each {
            if (it.isRunning()) {
                it.stop()
            }
        }
    }
}
```

2. Groovy `with` method 

We can also take advantage of some groovy goodness and declare and start docker container in one go like:

```groovy
class MySqlContainer {
    static final GenericContainer MY_SQL_CONTAINER = new GenericContainer("mysql:8")
            .withEnv("MYSQL_ROOT_PASSWORD", "password")
            .withEnv("MYSQL_DATABASE", "it")
            .withExposedPorts(3306)
            .with {
                it.start()
                it
            }
}
```

## Conclusion

When you want to use desired tools you will have to agree on a few workarounds to make everything works as you want. The biggest surprise for me was not being able to run `Micronaut` or `Testcontainers` just once out of the box together with `Spock`. It is also worth noticing that `Micronaut` and `Testcontainers` project contains modules for `JUnit` where start and stop functions are done in `BeforeAllCallback` and `AfterAllCallback` which base on Javadoc should be 
executed just once for a single extension (i.e. before and after all our tests).

The complete example can be found at [github](https://github.com/ajurasz/micronaut-it). There are two branches:

1) `develop` where `@MicronautTest` annotation is used together with `Spock` global extension
2) `shared-context` where `Micronaut` is started manually and docker containers by the usage of groovy `with` method
