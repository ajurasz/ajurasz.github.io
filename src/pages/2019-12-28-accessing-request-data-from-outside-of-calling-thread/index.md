---
title: "Accessing HTTP request data from outside of calling thread"
date: "2019-12-28"
tags: [spring]
---

It's almost end of 2019 but there is still a lot of application which depends on Servlet specification - this statement is base on my personal experience where I still see the majority of a new application being built using this technology. In this blog post, I will focus on a single use case where we will retrieve HTTP request data from outside of calling thread in `Spring Framework`.

<!-- end -->

## Problem

When using `spring-webmvc` in a standard way - according to Servlet 2.5 specification - then every incoming request is bound to a single thread for a life of that request (calling thread). Everything is fine until you start to do some _side processing in child thread_. This is a common case when moving to less coupled communicating between modules in an application through Spring's event bus. 

Let's consider the following scenario:

1) Rest controller calls service
2) Service publish event 
3) Event is processed by the listener in a new thread
4) The listener uses a service which at some point - in execution chain - requires data from the HTTP request

Output from above scenario will be sucessfull response to the client from rest controller and exception in logs saying that we try to access request attributes outside of an actual web request i.e:

```bash
java.lang.IllegalStateException: No thread-bound request found: Are you referring to request attributes outside of an actual web request, or processing a request outside of the originally receiving thread? If you are actually operating within a web request and still receive this message, your code is probably running outside of DispatcherServlet: In this case, use RequestContextListener or RequestContextFilter to expose the current request.
	at org.springframework.web.context.request.RequestContextHolder.currentRequestAttributes(RequestContextHolder.java:131) ~[spring-web-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at org.springframework.web.context.support.WebApplicationContextUtils.currentRequestAttributes(WebApplicationContextUtils.java:313) ~[spring-web-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at org.springframework.web.context.support.WebApplicationContextUtils.access$400(WebApplicationContextUtils.java:66) ~[spring-web-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at org.springframework.web.context.support.WebApplicationContextUtils$RequestObjectFactory.getObject(WebApplicationContextUtils.java:329) ~[spring-web-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at org.springframework.web.context.support.WebApplicationContextUtils$RequestObjectFactory.getObject(WebApplicationContextUtils.java:324) ~[spring-web-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at org.springframework.beans.factory.support.AutowireUtils$ObjectFactoryDelegatingInvocationHandler.invoke(AutowireUtils.java:295) ~[spring-beans-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at com.sun.proxy.$Proxy59.getHeader(Unknown Source) ~[na:na]
	at io.github.ajurasz.demo.GetUserId.userId(GetUserId.java:18) ~[classes/:na]
	at io.github.ajurasz.demo.MyEventListener.handleEvent(MyEventListener.java:28) ~[classes/:na]
	at io.github.ajurasz.demo.MyEventListener.handle(MyEventListener.java:23) ~[classes/:na]
	at io.github.ajurasz.demo.MyEventListener$$FastClassBySpringCGLIB$$e876a886.invoke(<generated>) ~[classes/:na]
	at org.springframework.cglib.proxy.MethodProxy.invoke(MethodProxy.java:218) ~[spring-core-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at org.springframework.aop.framework.CglibAopProxy$CglibMethodInvocation.invokeJoinpoint(CglibAopProxy.java:769) ~[spring-aop-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:163) ~[spring-aop-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at org.springframework.aop.framework.CglibAopProxy$CglibMethodInvocation.proceed(CglibAopProxy.java:747) ~[spring-aop-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at org.springframework.aop.interceptor.AsyncExecutionInterceptor.lambda$invoke$0(AsyncExecutionInterceptor.java:115) ~[spring-aop-5.2.2.RELEASE.jar:5.2.2.RELEASE]
	at java.base/java.util.concurrent.FutureTask.run$$$capture(FutureTask.java:264) ~[na:na]
	at java.base/java.util.concurrent.FutureTask.run(FutureTask.java) ~[na:na]
	at java.base/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1128) ~[na:na]
	at java.base/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:628) ~[na:na]
	at java.base/java.lang.Thread.run(Thread.java:834) ~[na:na]
```

All make sense as under the hood `RequestContextHolder` is used which in turn stores request attributes in `ThreadLocal`.

## Solution

To access HTTP request data from outside of calling thread we could extend `ThreadPoolTaskExecutor`, copy existing request attributes provided by `RequestContextHolder#currentRequestAttributes` and set them in a new thread through `RequestContextHolder#setRequestAttributes`. Below is sample implementation:

```java
class MyThreadPoolTaskExecutor extends ThreadPoolTaskExecutor {
    @Override
    public <T> Future<T> submit(Callable<T> task) {
        return super.submit(new MyCallable<>(task, RequestContextHolder.currentRequestAttributes()));
    }

    @Override
    public <T> ListenableFuture<T> submitListenable(Callable<T> task) {
        return super.submitListenable(new MyCallable<>(task, RequestContextHolder.currentRequestAttributes()));
    }

    private static class MyCallable<T> implements Callable<T> {
        private final Callable<T> callable;
        private final RequestAttributes requestAttributes;

        private MyCallable(Callable<T> callable, RequestAttributes requestAttributes) {
            this.callable = callable;
            this.requestAttributes = copy(requestAttributes);
        }

        private RequestAttributes copy(RequestAttributes requestAttributes) {
            // RequestAttributes needs to be copied as it will be garbage collected when origin request will complete.
            return requestAttributes;
        }

        @Override
        public T call() throws Exception {
            try {
                RequestContextHolder.setRequestAttributes(requestAttributes);
                return callable.call();
            } finally {
                RequestContextHolder.resetRequestAttributes();
            }
        }
    }
}
```

Then we need to instruct spring to use our custom implementation of `TaskExecutor` like so:

```java
    @Bean
    TaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor taskExecutor = new MyThreadPoolTaskExecutor();
        taskExecutor.setMaxPoolSize(10);
        taskExecutor.setQueueCapacity(100);
        taskExecutor.setThreadNamePrefix("my-executor-");
        return taskExecutor;
    }
```

Please notice that the above solution should be considered more like a workaround than a final solution. A better approach would be to extract all required data while still in the context of calling thread and then pass these data to all interested parties.

The full example can be found at [github]().
