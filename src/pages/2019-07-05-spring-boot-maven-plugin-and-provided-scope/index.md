---
title: "Spring Boot Maven Plugin and provided scope"
date: "2019-07-05"
tags: [springboot]
---

If you come from the JavaEE world you probably did set some of your project dependencies to the scope of `provided` if so then you can find one fact about `spring-boot-maven-plugin` to be interesting.

<!-- end -->

After adding `provided` scope to a dependency you expect that JDK or container (like JavaEE application server) will provide this dependency at runtime. Expected behaviour when running application without providing these dependencies will be to see `NoClassDefFoundError` or `ClassNotFoundException` all depends on how these missing classes are accessed (for more information see [this article](https://dzone.com/articles/java-classnotfoundexception-vs-noclassdeffounderro)). But this is not a case when using `spring-boot-maven-plugin` to run your application in standalone mode i.e. outside of any kind of container. After reading the explanation from Phil Webb (Pivotal) this behaviour makes sense:

> The packaging of provided scoped jars is intentional. The reason for this is that many developers are used to adding things like servlet-api as provided. Since there won't be a servlet container to actually "provide" the dependency we package it inside the JAR.

Source: [https://github.com/spring-projects/spring-boot/issues/413#issuecomment-36361340](https://github.com/spring-projects/spring-boot/issues/413#issuecomment-36361340)

In `spring-boot-maven-plugin` sources we can find how dependencies are loaded for `run` goal.

`AbstractRunMojo.java`:

```java
private void addDependencies(List<URL> urls) throws MalformedURLException, MojoExecutionException {
    FilterArtifacts filters = (this.useTestClasspath ? getFilters() : getFilters(new TestArtifactFilter()));
    Set<Artifact> artifacts = filterDependencies(this.project.getArtifacts(), filters);
    for (Artifact artifact : artifacts) {
        if (artifact.getFile() != null) {
            urls.add(artifact.getFile().toURI().toURL());
        }
    }
}
```

`this.project.getArtifacts()` loads all project dependencies including transitive ones (`provided` scoped are loaded as well!). After, the load is done we removed dependencies based on configured filters - by default only test classes are removed. Yet it is still possible to make some exclusion in the plugin configuration.

## Conclusion

When your project deliverable is a war file that will be run in a container then it is very pleasant to be able to run it in standalone mode without additional tweaks when there are some `provided` scoped dependencies.
