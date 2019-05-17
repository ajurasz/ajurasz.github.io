---
layout: post
date: 2018-09-09 12:00
title: "Adding deb packages to Cloud Foundry instances"
description: Adding deb packages to Cloud Foundry instances
tags: [cloud_foundry]
---

This blog post presents two ways of adding additional deb packages to your [Cloud Foundry](https://www.cloudfoundry.org/) (CF) instances.

<!--more-->

### Buildpack

Before moving forward let's introduce some useful buildpacks that we will be using. What is buildpack you may ask. `"Buildpacks provide framework and runtime support for apps"`, in other words, CF have some predefined "recipes" how to prepare instances to run your application. So if you will push your application with CLI, CF will examine your app and will use appropriate buildpack to prepare your instance. You can also be more explicit and say what buildpack you want to use. Here you can find a list of builtin buildpacks [https://docs.cloudfoundry.org/buildpacks/#system-buildpacks](https://docs.cloudfoundry.org/buildpacks/#system-buildpacks).

We will be using:

1) [apt-buildpack](https://github.com/cloudfoundry/apt-buildpack) - allow us to list all deb packages we want to install in `apt.yml` file. It's supporting custom apt repositories as well.  
2) [binary-buildpack](https://github.com/cloudfoundry/binary-buildpack) - this buildpack allow you to run binary web services that do not require any runtime dependencies (any of these sould be statically linked to your binary). Good buildpack just for preparing "clean" instance.  
3) [multi-buildpack](https://github.com/cloudfoundry/multi-buildpack) - as names suggests for running multiple buildpacks.  


### Using multi-buildpack

1) Create `multi-buildpack.yml` file where you specify all buildpacks you want to run:

{% highlight yml %}
buildpacks:
- https://github.com/cloudfoundry/apt-buildpack
- https://github.com/cloudfoundry/java-buildpack
{% endhighlight %}

2) Create `apt.yml` file

{% highlight yml %}
---
packages:
- mysql-client
{% endhighlight %}

3) Create `manifest.yml` file

{% highlight yml %}
applications:
- name: my-app
  buildpack: https://github.com/cloudfoundry/multi-buildpack
  instances: 1
  memory: 1G
{% endhighlight %}

4) Push to CF

{% highlight shell %}
cf push 
{% endhighlight %}

Above command will:
- by default look for `manifest.yml` in the current directory ([more](https://docs.cloudfoundry.org/devguide/deploy-apps/manifest.html#-how-cf-push-finds-the-manifest))
- by default, it will recursively push all files in the current directory ([more](https://docs.cloudfoundry.org/devguide/deploy-apps/manifest.html#find-app))  

Directory structure:

{% highlight shell %}
.
├── apt.yml
├── manifest.yml
├── multi-buildpack.yml
└── my-app.jar
{% endhighlight %}

#### Cons

When using multi-buildpack you cannot use builtin buildpacks which can be an issue when working on a company's own installation of CF and its policy require from you to be using built-in (customized) buildpacks.

### Pushing multiple buildpacks

1) Create `apt.yml` file

{% highlight yml %}
---
packages:
- mysql-client
{% endhighlight %}

3) Create `manifest.yml` file

{% highlight yml %}
applications:
- name: my-app
  buildpack: https://github.com/cloudfoundry/binary-buildpack
  path: ./my-app.jar
  instances: 1
  memory: 1G
{% endhighlight %}

4) Embed `apt.yml` at the root of your project

With maven, this can be done with the help of [maven-antrun-plugin](http://maven.apache.org/plugins/maven-antrun-plugin/) and by adding following to your `pom.xml` file:

{% highlight xml %}
<plugin>
    <artifactId>maven-antrun-plugin</artifactId>
    <executions>
        <execution>
            <id>addCFAptAtRootLevel</id>
            <phase>package</phase>
            <configuration>
                <target>
                    <zip destfile="${project.build.directory}/${app.finalName}.jar"
                         update="yes" compress="false" >
                        <zipfileset dir="." includes="apt.yml"/>
                    </zip>
                </target>
            </configuration>
            <goals>
                <goal>run</goal>
            </goals>
        </execution>
    </executions>
</plugin>
{% endhighlight %}

5) Push to CF

{% highlight shell %}
cf push --no-start (1)
cf push my-app -b https://github.com/cloudfoundry/apt-buildpack -b java_buildpack (2)
{% endhighlight %}

(1) sets up instance and do not start it  
(2) we need to specify the app name we want to update. In this case, we just update the buildpack section of deployed manifest. We can also use public and builtin buildpacks  

Directory structure:

{% highlight shell %}
.
├── manifest.yml
└── my-app.jar
{% endhighlight %}

#### Cons

Above approach (2) is available starting from `cf` CLI version `v6.38` or later. Before you had to use a different command for pushing multiple buildpacks:

{% highlight shell %}
cf v3-push -b https://github.com/cloudfoundry/apt-buildpack -b java_buildpack
{% endhighlight %}
