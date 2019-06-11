---
title: "Build a native image with GraalVM"
date: "2019-06-08"
tags: [java]
---

Last month first production-ready version of `GraalVM` with number `19.0` was released. `GraalVM` is a virtual machine capable to run application written in `JavaScript`, `Python`, `Ruby`, `R`, LLVM-based languages like `C`, `C++` and of course our beloved JVM-based languages like `Java`, `Scala`, `Kotlin`, `Groovy` and `Clojure`. Some of the main goals for this new virtual machine are:
 - improve the performance of applications build with JVM-based languages
 - reduce startup time by usage of AOT (ahead-of-time) compilation
 - write polyglot applications
 - compile JVM-based code to a standalone executable a.k.a. native image.

<!-- end -->

With this post, I would like to focus on the last goal and build a native image. The assumption is very simple, take [JsonPath](https://github.com/json-path/JsonPath) library, write some `Java` code to interact with this library and then from terminal quickly test any [JsonPath](https://github.com/json-path/JsonPath) expression you can think of, like

```bash
curl -s https://api.github.com/users/ajurasz | json_path "$.created_at"
```

## Native image?

As already mentioned one of the main goals of `GraalVM` is the possibility to produce native images which are executables that do not require JRE (java runtime environment) to be present on the system. At first, when I heard about this feature I thought that the code instead to be compiled to bytecode will be directly compiled to machine code but I was wrong. During the process of creating a native image, all classes of our application and their dependencies are statically analyses to know which part of that code is reachable during runtime. These static analyses take JDK code under consideration as well. When we know all classes and methods used in the runtime then `GraalVM` compiles it ahead-of-time. To make this AOT compiled code to run we still need some runtime on which our program can be run. The produced native image includes something called `Substrate VM` which is an embeddable virtual machine containing components like memory management, thread scheduling, de-optimizer or even garbage collector. Having an initial idea about what native image is let's install `GraalVM`, `native-image` utility and write some code.

## Installation

First, let's install `GraalVM` through `sdkman`

```bash
sudo apt update
sudo apt install unzip zip
curl -s "https://get.sdkman.io" | bash
source "/home/ubuntu/.sdkman/bin/sdkman-init.sh"
sdk install java 19.0.0-grl
```

To use `native-image` command beside native image utility there are some [prerequisites](https://www.graalvm.org/docs/reference-manual/aot-compilation/#prerequisites)

```bash
gu install native-image
sudo apt install build-essential
sudo apt install libz-dev
```

## Code

As shown above, we want to pipe output from `curl` command to our application as input. To get access to this input from application level we need to read it from `System.in`. [JsonPath](https://github.com/json-path/JsonPath) expression will be simply passed as an argument. In the end, we just need to evaluate the expression against received json. 
  
```java
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.stream.Collectors;

import com.jayway.jsonpath.JsonPath;

public class Application {
    public static void main(String[] args) {
        String expression = extractExpression(args);
        String json = readInput();

        System.out.println(evaluate(json, expression));
    }

    private static String extractExpression(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Single JsonPath expression is required.");
        }
        return args[0];
    }

    private static String readInput() {
        return new BufferedReader(new InputStreamReader(System.in))
                .lines()
                .collect(Collectors.joining("\n"));
    }

    private static String evaluate(String json, String expression) {
        JsonPath jsonPath = JsonPath.compile(expression);
        return jsonPath.read(json);
    }
}
```

## Compilation 

First, we need to compile our java code with `javac` command

```bash
javac -cp "libs/*" Application.java
```

`libs` directory contains all 3rd party dependencies required for this application to run

```bash
tree
.
├── Application.java
└── libs
    ├── accessors-smart-1.2.jar
    ├── asm-5.0.4.jar
    ├── json-path-2.4.0.jar
    ├── json-smart-2.3.jar
    ├── slf4j-api-1.7.25.jar
    └── slf4j-jdk14-1.7.25.jar

1 directory, 8 files
```  

After successful ran of compile command `Application.class` should be produced.

## Build native image

Command to build native image is very similar to compiling java file, it requires only java class and `-cp` parameter in case if we use external dependencies which we do.

```bash
native-image -cp ".:libs/*" -H:Name=json_path  Application 
```

`-H:Name` is used just to give a name to produced executable. But running above command will fail with the following message

```bash
Warning: Aborting stand-alone image build. com.oracle.svm.hosted.substitute.DeletedElementException: Unsupported method java.lang.ClassLoader.defineClass(String, byte[], int, int) is reachable: The declaring class of this element has been substituted, but this element is not present in the substitution class
To diagnose the issue, you can add the option --report-unsupported-elements-at-runtime. The unsupported element is then reported at run time when it is accessed the first time.
Detailed message:
Trace:
        at parsing net.minidev.asm.DynamicClassLoader.defineClass(DynamicClassLoader.java:86)
Call path from entry point to net.minidev.asm.DynamicClassLoader.defineClass(String, byte[]):
        at net.minidev.asm.DynamicClassLoader.defineClass(DynamicClassLoader.java:81)
        at net.minidev.asm.BeansAccessBuilder.bulid(BeansAccessBuilder.java:313)
        at net.minidev.asm.BeansAccess.get(BeansAccess.java:111)
        at net.minidev.json.reader.BeansWriterASM.writeJSONString(BeansWriterASM.java:17)
        at net.minidev.json.JSONValue.writeJSONString(JSONValue.java:586)
        at net.minidev.json.reader.JsonWriter$5.writeJSONString(JsonWriter.java:113)
        at net.minidev.json.reader.JsonWriter$5.writeJSONString(JsonWriter.java:1)
        at net.minidev.json.JSONArray.writeJSONString(JSONArray.java:75)
        at net.minidev.json.JSONArray.toJSONString(JSONArray.java:52)
        at net.minidev.json.JSONArray.toJSONString(JSONArray.java:102)
        at net.minidev.json.JSONArray.toString(JSONArray.java:113)
        at java.lang.String.valueOf(String.java:2994)
        at java.lang.StringBuilder.append(StringBuilder.java:131)
        at com.oracle.svm.core.amd64.AMD64CPUFeatureAccess.verifyHostSupportsArchitecture(AMD64CPUFeatureAccess.java:179)
        at com.oracle.svm.core.JavaMainWrapper.run(JavaMainWrapper.java:131)
        at com.oracle.svm.core.code.IsolateEnterStub.JavaMainWrapper_run_5087f5482cc9a6abc971913ece43acb471d2631b(generated:0)
```

Native images don't support dynamic class loading and this is understandable due to the nature of AOT compilation where all classes and bytecodes that are ever reachable needs to be known at compile time. To see the full list of native image limitation see [https://github.com/oracle/graal/blob/master/substratevm/LIMITATIONS.md](https://github.com/oracle/graal/blob/master/substratevm/LIMITATIONS.md). But we still can take advantage of the suggested solution and postpone any errors resulting from dynamic class loading to runtime by using `--report-unsupported-elements-at-runtime` option. Let's make the second attempt to build a native image

```bash
 native-image -cp ".:libs/*" -H:Name=json_path --report-unsupported-elements-at-runtime  Application
 ```
 
 This time it worked and `json_path` executable was created. To make our life easier let's register this executable to be accessible globally in our system
 
 ```bash
sudo ln -s /home/ubuntu/app/json_path /usr/local/bin/json_path
```

and let's give it a try

```bash
curl -s https://api.github.com/users/ajurasz | json_path "$.created_at"
2013-03-23T12:56:53Z
```

Works like a charm but what about some more complex expressions

```bash
curl -s https://www.anapioficeandfire.com/api/books/1 | json_path "$.characters.length()"

Exception in thread "main" com.jayway.jsonpath.InvalidPathException: Function of name: length cannot be created
        at com.jayway.jsonpath.internal.function.PathFunctionFactory.newFunction(PathFunctionFactory.java:75)
        at com.jayway.jsonpath.internal.path.FunctionPathToken.evaluate(FunctionPathToken.java:38)
        at com.jayway.jsonpath.internal.path.PathToken.handleObjectProperty(PathToken.java:81)
        at com.jayway.jsonpath.internal.path.PropertyPathToken.evaluate(PropertyPathToken.java:79)
        at com.jayway.jsonpath.internal.path.RootPathToken.evaluate(RootPathToken.java:62)
        at com.jayway.jsonpath.internal.path.CompiledPath.evaluate(CompiledPath.java:53)
        at com.jayway.jsonpath.internal.path.CompiledPath.evaluate(CompiledPath.java:61)
        at com.jayway.jsonpath.JsonPath.read(JsonPath.java:181)
        at com.jayway.jsonpath.JsonPath.read(JsonPath.java:345)
        at com.jayway.jsonpath.JsonPath.read(JsonPath.java:329)
        at Application.evaluate(Application.java:30)
        at Application.main(Application.java:12)
Caused by: java.lang.InstantiationException: Type `com.jayway.jsonpath.internal.function.text.Length` can not be instantiated reflectively as it does not have a no-parameter constructor or the no-parameter constructor has not been added explicitly to the native image.
        at java.lang.Class.newInstance(DynamicHub.java:740)
        at com.jayway.jsonpath.internal.function.PathFunctionFactory.newFunction(PathFunctionFactory.java:73)
        ... 11 more
```

So a new instance of `Length` type cannot be created. Quick sneak peek on failing part (`PathFunctionFactory.java:75`)

```java
public static PathFunction newFunction(String name) throws InvalidPathException {
    Class functionClazz = FUNCTIONS.get(name);
    if(functionClazz == null){
        throw new InvalidPathException("Function with name: " + name + " does not exist.");
    } else {
        try {
            return (PathFunction)functionClazz.newInstance();
        } catch (Exception e) {
            throw new InvalidPathException("Function of name: " + name + " cannot be created", e);
        }
    }
}
```

That's true, it looks like there is a set of predefined function which then are dynamically created. Fortunately, this can be fixed by introducing reflection configuration file. This file is used to inform `Substrate VM` about reflectively accessed program elements. To know more see [https://github.com/oracle/graal/blob/master/substratevm/REFLECTION.md](https://github.com/oracle/graal/blob/master/substratevm/REFLECTION.md). To solve above issue we need to put one entry in `graal.json`

```json
[
  {
    "name": "com.jayway.jsonpath.internal.function.text.Length",
    "methods": [
      { "name": "<init>", "parameterTypes": [] }
    ]
  }
]
```

After the rebuild of `json_path` executable, previous commands started to work

```bash
curl -s https://www.anapioficeandfire.com/api/books/1 | json_path "$.characters.length()"
434
        
curl -s https://www.anapioficeandfire.com/api/books | json_path "$.[?(@.name == 'A Game of Thrones')].characters.length()"
[434]
```

## Conclusion

I see the big potential in these native images one of them is light and fast docker images [https://blog.softwaremill.com/small-fast-docker-images-using-graalvms-native-image-99c0bc92e70b](https://blog.softwaremill.com/small-fast-docker-images-using-graalvms-native-image-99c0bc92e70b) as pointed out by Adam Warski. What he also mention is that in Scala reflection is almost unused. For me compiling a very simple program to the native image was a few hours of research and at this point, I don't see how I could do the same with small `Spring` application which in contrast to Scala ecosystem use reflection heavily.
