---
layout: post
date: 2017-05-28 12:00
title: "Kotlin + AWS Lambda + Serverless Framework"
description: Example project written in Kotlin and ran on AWS as Lambda functions.
image:
tags: [kotlin, aws_lambda, serverless]
---

Some time ago I came across the following tweet.
<img src="{{ site.url }}/img/posts/tweet_aws_kotlin.jpg" style="width: 100%;">
There were two things that took my attention - kotlin and Rekognition.

<!--more-->

First one is a "new" (it's relly developed by over 6 years now) JVM language created by JetBrains, company that stands behind great tooling for developers of different professions. The second is an AWS service, this is how it is described on their page

> Amazon Rekognition is a service that makes it easy to add image analysis to your applications. With Rekognition, you can detect objects, scenes faces; search and compare faces, and identify inappropriate content in images. Rekognition’s API enables you to quickly add sophisticated deep learning-based visual search and image classification to your applications.

as we will see soon this API is very easy to use.

## Why

At this point for me, it was the first contact with pretty nice and interesting example of AWS Lambda usage created by [Vladimir Budilov](https://twitter.com/VladimirBudilov) and available on [github](https://github.com/awslabs/serverless-photo-recognition). For these who are not familiar with AWS Lambda term -  it is a new category of cloud computing services called FaaS (function as a service). It stands next to IaaS (infrastructure as a service), PaaS (platform as a service) and SaaS (software as a service) it is also referred as Serverless architecture. In short, you focus only on your business logic and don't care about provisioning and managing servers.
<img src="{{ site.url }}/img/posts/faas_diagram.jpg" style="width: 100%;">
<sub>Source: Deploy microservice using Amazon Web Services S3, API Gateway, Lambda and Couchbase by Arun Gupta (https://www.youtube.com/watch?v=eT4EaU2mfL0)</sub>
After analysing [serverless-photo-recognition](https://github.com/awslabs/serverless-photo-recognition) repository I felt urgent need to write something of my own. One thing that I considered not to be very concise was a setup step. The author created setup [script](https://github.com/awslabs/serverless-photo-recognition/blob/master/setup/setupEnvironment.sh) which is very verbose. So let's start by making this process a lot more easier (to make and understand).

## Serverless framework

[Serverless framework](https://serverless.com/) is a cli tool that creates great abstraction over [AWS CloudFormation](https://aws.amazon.com/cloudformation/) and automates the whole process of setting up cloud infrastructure required by our functions. We start by installing serverless

```shell
npm install -g serverless
```

then a good idea is to create dedicated AWS user that will be used one behalf of serverless framework. Exact instruction of how to accomplish this can be found [here](https://serverless.com/framework/docs/providers/aws/guide/credentials/). In my case, this user hides behind `sless` AWS cli profile name - [see here](https://github.com/ajurasz/ascii-less-gallery/blob/58ad818d1d0d7131b4cb5ad9e027cea815197656/serverless.yml#L6). All configuration is placed in one file `serverless.yml`
where we first define `provider`

```shell
provider:
  name: aws
  runtime: java8
  profiles: sless
  timeout: 60
  environment:
    DYNAMODB_USER_TABLE: ${self:service}-${opt:stage, self:provider.stage}-user
    ES_DOMAIN_NAME: es-gallery
    REDIS_URL: ${file(serverless-config.yml):${opt:stage, self:provider.stage}.RedisUrl}
    REDIS_PORT: ${file(serverless-config.yml):${opt:stage, self:provider.stage}.RedisPort}
    ES_URL: ${file(serverless-config.yml):${opt:stage, self:provider.stage}.ElasticsearchUrl}
  iamRoleStatements:
    - Effect: "Allow"
      Action:
        - "lambda:InvokeFunction"
      Resource: "*"
    - Effect: "Allow"
      Action:
        - "rekognition:DetectLabels"
      Resource: "*"
    - Effect: "Allow"
      Action:
        - "es:ESHttpDelete"
        - "es:ESHttpGet"
        - "es:ESHttpPost"
        - "es:ESHttpPut"
      Resource: "arn:aws:es:${opt:region, self:provider.region}:*:domain/${self:provider.environment.ES_DOMAIN_NAME}/*"
    - Effect: Allow
      Action:
        - "dynamodb:GetItem"
        - "dynamodb:PutItem"
      Resource: "arn:aws:dynamodb:${opt:region, self:provider.region}:*:table/${self:provider.environment.DYNAMODB_USER_TABLE}"
```

this is a place where we can configure mentioned AWS cli profile, runtime environment, extend the limit of our functions execution time to 60 sec, define environment variables that will be accessible from within our functions and also we can define a security policy for a lambda role created automatically by `serverless`. From above snippet, we see that security statements were defined for lambda, elasticsearch, rekognition and dynamodb services, specifying what action we can execute on them.

## Lambda in action

I wrote a simple CRD (no update) functions with custom authentication mechanism - probably using [AWS Cognito](https://aws.amazon.com/cognito/) would be a preferred way to go but I wanted to check how flexible are these lambda functions in terms of implementing own authentication. Application architecture is following

<img src="{{ site.url }}/img/posts/architecture_aws_lambda.png" style="width: 100%;">

I believe that above diagram is self-explanatory so let's dive into one of the functions. [CreateHandler](https://github.com/ajurasz/ascii-less-gallery/blob/master/src/main/kotlin/ajurasz/lambda/gallery/CreateHandler.kt), the entry point is `handleRequest` function triggered by AWS when an HTTP POST request reaches API Gateway at /gallery path.

```shell
    override fun handleRequest(input: Request, context: Context): String {
        LOG.debug("input(\n$input\n)")

        if (input.base64Image == null || (input.base64Image as String).isBlank())
            return response(400, "Invalid identify request: no or empty 'base64Image' field supplied")

        val imageInBytes = base64ToBytes(input.base64Image!!)
        val labels = rekognitionService.imageLabels(imageInBytes)

        val galleryItem = createGalleryItem(asciiService, imageInBytes, labels)
        val result = esService.add(input.principalId!!, galleryItem)

        when(result) {
            true -> return galleryItem.id
            else -> return response(500, "Failed to save image")
        }
    }
```

In this function, we validate incoming request to check if base64 encoded image string exists and is not blank. Then encoded image is converted to `byte` array and passed to Rekognition service. This service is a wrapper around AWS Rekognition service to simplify interaction with it.

```shell
    fun imageLabels(image: ByteArray): List<String> {
        LOG.info("Recognize image labels")
        val response = amazonRekognition.detectLabels(DetectLabelsRequest()
                .withMaxLabels(10)
                .withMinConfidence(60f)
                .withImage(Image().withBytes(ByteBuffer.wrap(image))))

        return response?.labels?.map { it.name }.orEmpty()
    }
```

As mentioned at the beginning, using AWS Rekognition service we were able to define a sophisticated deep learning-based operation of labelling objects present on a given image just in few lines of code.
When using serverless framework we need to create a configuration for each function. Configuration for `CreateHandler` function is following

```shell
  create:
    handler: ajurasz.lambda.gallery.CreateHandler
    events:
      - http:
          path: gallery
          method: post
          integration: lambda
          request:
            passThrough: WHEN_NO_TEMPLATES
            template:
              image/png: '{ "operation" : "create", "base64Image" : "$input.body", "principalId" : "$context.authorizer.principalId" }'
          authorizer:
            name: auth
            resultTtlInSeconds: 30
            identitySource: method.request.header.token
```

we see that this function is triggered by HTTP specific event - POST request to `/gallery` path. This configuration is little bit more complicated than for other functions and this is because we are not using default `lambda-proxy` integration (integration between API Gateway and Lambda) as we need to customize it to handle binary data. More information about handling binary data in AWS Lambda can be found [here](https://aws.amazon.com/blogs/compute/binary-support-for-api-integrations-with-amazon-api-gateway/). We also secured our function with `auth` function that will be invoked before target function to check if supplied token is valid. We are also able to cache response of `auth` function where cache key is a `identitySource`. Usually when using proxy approach the whole request is forwarded to our function and configuration is as easy as

```shell
  list:
    handler: ajurasz.lambda.gallery.ListHandler
    events:
      - http:
          path: gallery
          method: get
```

or

```shell
  delete:
    handler: ajurasz.lambda.gallery.DeleteHandler
    events:
      - http:
          path: gallery/{id}
          method: delete
          authorizer:
            name: auth
            resultTtlInSeconds: 30
            identitySource: method.request.header.token
```

when we want to secure our endpoint.

## Testing

With good encapsulation, you can test a lot. In my case, I only was not able to test Rekognition and DynamoDB services so had to use mocks. Recently (again, thank you Twitter) I found that [allegro tech tema](https://github.com/allegro) open sourced [embedded ElasticSearch](https://github.com/allegro/embedded-elasticsearch) to make unit and integration testing easier and more reliable.

## Deployment
This can obviously be a part of CI/CD pipeline as when everything is ready you need to execute just two commands

```shell
./gradlew test
serverless deploy
```

this could be simplified to just one command by executing `serverless` command from within gradle task.

## Conclusion
Personally, I wouldn't consider building my whole application as functions from one simple reason - vendor locking ([this article](https://startupsventurecapital.com/firebase-costs-increased-by-7-000-81dc0a27271d) is kind of "lessons learned" type in terms of vendor locking). But this is a great option when you need to run some simple function triggered by different events somewhere on the web. There is still some lack in case of debugging (or I didn't yet discover how to make it properly) these functions - at this point I will say only: logger is your friend.
