---
title: "Continuous Deployment on Kubernetes"
date: "2020-04-12"
tags: [cd, kubernetes]
---

If you are wondering how could you set up your build pipeline to do a deployment of your application to Kubernetes cluster then you can find this post interesting.

<!-- end -->

## Disclaimer

Everything that will be presented in this blog post was only used for Test and QA environments as a way to learn more about Kubernetes. It was not used for Prod environment yet so please keep this in your mind.

## Stack

Before moving to details it's worth mentioning what I have to disposal:

- Kubernetes cluster
- Jenkins pipeline job
- Private Docker registry
- Dockerized application

## Build

Since Jenkins pipeline job is in place then the deployment is as easy as adding a new stage to an existing job pipeline. I have called mine `Deploy`. This stage is responsible for the following:

- run only on `develop` branch
- build docker image
- push the docker image to a repository
- call [Kubernetes Continuous Deploy Plugin](https://jenkins.io/doc/pipeline/steps/kubernetes-cd/#kubernetes-continuous-deploy-plugin)
- remove docker image from Jenkins worker (just to save space)

```
pipeline {
    stages {
        stage('Deploy') {
            when {
                branch "develop"
            }

            environment {
                DOCKER_REPOSITORY = '127.0.0.1:5000'
                IMAGE_NAME = 'app'
                IMAGE_TAG = sh(script: "git log -1 --pretty=%h", returnStdout: true).trim()
                APP_IMAGE = "${DOCKER_REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"
            }

            steps {
                sh """
                docker build -t ${APP_IMAGE} ./docker
                """

                sh """
                docker push ${APP_IMAGE}
                """

                kubernetesDeploy(kubeconfigId: 'k8s-config', configs: '**/k8s/qa/app.yml')
            }

            post {
                always {
                    sh """
                    docker rmi ${APP_IMAGE}
                    """
                }
            }
        }
    }
}
```

In the above snippet, there are two important things to notice. First is the registration of environment variable with name `APP_IMAGE`. The second most important thing is that kubernetes-cd plugin can substitute variables in the form of `${APP_IMAGE}` in the configuration file (`app.yml`) with variables from Jenkins environment. This is the default behaviour of the plugin and can be disabled with `enableConfigSubstitution` set to `false`.

Kubernetes configuration consists of the standard objects needed for deploying an application to the cluster

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-qa
  labels:
    app: app-qa
    env: qa
spec:
  replicas: 1
  revisionHistoryLimit: 1
  selector:
    matchLabels:
      app: app-qa
      env: qa
  template:
    metadata:
      labels:
        app: app-qa
        env: qa
    spec:
      containers:
        - name: app-qa
          image: ${APP_IMAGE}
          imagePullPolicy: "IfNotPresent"
          ports:
            - containerPort: 8080
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: qa
          resources:
            limits:
              cpu: 500m
              memory: 256Mi
            requests:
              cpu: 500m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: app-qa
  labels:
    app: app-qa
    env: qa
spec:
  type: NodePort
  ports:
    - port: 8080
      nodePort: 31000
  selector:
    app: app-qa
    env: qa

```

When the above configuration is applied then Kubernetes only updates these object that did change. So in case of successive deployment, only `Deployment` object is updated which represents our application. `revisionHistoryLimit` is an extra configuration which keeps previous `Deployment` object just in case if rollback is necessary.