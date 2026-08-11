# Sleepr project: "NestJs Microservices: Build & Deploy a Scalable Backend"

<table align="center">
  <td align="center">
    <img src="/sleeprMicroservices.png" alt="User menu options" width="1200" />
  </td>
</table>

---

# Summary of the Application

## The big picture

This application has **4 microservices** and basically works in the following way:

1. A user **authenticates** in the system using the **auth** microservice.
2. The user **creates a reservation** using the **reservations** microservice.
3. When he is about to pay the reservation, this activates the **payments** microservice, which is using a **Stripe API** integration.
4. When the payment is completed successfully, this will activate the **notifications** microservice (using **nodemailer**) to send the confirmation email.

```
  User ──► auth ──► reservations ──► payments (Stripe) ──► notifications (nodemailer)
           login      create           charge the card         "your reservation is confirmed!"
```

So it's a little chain reaction: each service does one job well and then hands the work to the next one. That's the whole point of microservices — instead of one giant app doing everything, you get four small apps that talk to each other.

Everything lives in a **NestJS monorepo**: each microservice is a folder inside `apps/`, and the code they all share (database module, auth guards, DTOs, etc.) lives in `libs/`. That's why you'll see the same shared imports across services without copy-pasting anything.

---

## Docker: one Dockerfile per microservice

Each microservice has its **own `Dockerfile`** inside its folder:

```
apps/auth/Dockerfile
apps/reservations/Dockerfile
apps/payments/Dockerfile
apps/notifications/Dockerfile
```

Here's the part that confused me at first, so let me explain it properly: these are **multi-stage builds**. Each Dockerfile defines two stages (`development` and `production`) in the same file:

- **`development` stage** — installs *all* dependencies (including dev ones), copies the source, and runs `pnpm run build <service>`. This is the stage that compiles the TypeScript.
- **`production` stage** — starts from a fresh `node:alpine`, installs **only** production dependencies (`pnpm install --prod`), and then copies just the compiled `dist/` folder out of the development stage:

```dockerfile
COPY --from=development /usr/src/app/dist ./dist
CMD [ "node", "dist/apps/auth/main" ]
```

Why bother? Because the final image doesn't carry the TypeScript compiler, the test libraries, or any of the dev tooling. It's a much smaller and safer image — you ship the *result* of the build, not the build tools. That `--from=development` line is the trick that makes it work.

One important detail: the **build context is always the monorepo root** (`.`), not the service folder. That's why the builds are always run as `docker build -f apps/auth/Dockerfile .` — the Dockerfile needs access to `libs/`, `tsconfig.json` and `nest-cli.json`, which live at the root.

---

## The `docker-compose.yaml` — my local development environment

At the root of the project there's a `docker-compose.yaml` that spins up **the whole system with a single command**:

```bash
docker compose up
```

It brings up the four microservices **plus a PostgreSQL 15 container**, all wired together on the same Docker network, so `auth` can reach `postgres` just by using the hostname `postgres`. No more "works on my machine" — anyone can clone the repo and run everything.

Let me break down what each part of a service block is doing:

```yaml
  auth:
    build:
      context: .                          # monorepo root, so libs/ is visible
      dockerfile: ./apps/auth/Dockerfile
      target: development                 # stop at the dev stage, don't build production
    command: pnpm start:dev auth          # Nest watch mode
    env_file:
      - ./apps/auth/.env                  # each service has its own secrets
    ports:
      - "3001:3001"
    volumes:
      - .:/usr/src/app                            # bind mount = hot reload
      - auth_node_modules:/usr/src/app/node_modules
      - auth_app_node_modules:/usr/src/app/apps/auth/node_modules
```

**`target: development`** — remember the multi-stage Dockerfile? Locally I don't want the production image, I want the one with all the dev tooling still inside. `target` tells Docker to stop at that stage.

**The volumes are the coolest part, and also the trickiest.** There are two different kinds here and they're doing opposite jobs:

- `.:/usr/src/app` is a **bind mount**: it maps my local project folder straight into the container. So when I save a file in VS Code, the file changes *inside the running container too*, Nest's watch mode (`start:dev`) notices it and restarts the app. That's the **hot reload** — no rebuilding the image every time I change a line of code.
- `auth_node_modules:/usr/src/app/node_modules` is a **named volume**, and it exists to *fix a problem the bind mount creates*. The bind mount overwrites everything at `/usr/src/app` with my host folder — including `node_modules`. But the dependencies installed inside the container (Linux/Alpine binaries) are not the same as the ones on my host machine. Mounting a named volume **on top** of that path shields the container's own `node_modules` from being shadowed. In a monorepo you need this at two levels: the root `node_modules` and the service's `apps/auth/node_modules`, which is exactly why you see two of them per service.

**Debugging:** the `reservation` service runs with `pnpm start:debug` and exposes port **9229** as well as 3000. That's the Node.js inspector port, so I can attach the VS Code debugger and put real breakpoints inside a container. 

**Postgres:** it's published as `"5433:5432"` — port 5432 inside the container, but 5433 on my machine, so it doesn't collide with a local Postgres installation I might already have running.

Each microservice loads its own `.env` through `env_file`, so the Stripe key only goes to `payments`, the SMTP credentials only go to `notifications`, and so on.

---

## Deploying to the cloud: GCP and AWS

In this project I learned to deploy this application on **both cloud providers**, using the same Docker images but two different CI pipelines.

### `cloudbuild.yaml` — Google Cloud Platform

This is the config file for **Google Cloud Build**. It's a list of `steps`, and each step is basically "run this container with these arguments". Every step here uses the official `gcr.io/cloud-builders/docker` image, so the whole file is just: **build an image, push it, repeat for all 4 services**.

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t',
      'southamerica-east1-docker.pkg.dev/sleepr-492115/auth/production',
      '-f', 'apps/auth/Dockerfile', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push',
      'southamerica-east1-docker.pkg.dev/sleepr-492115/auth/production']
```

The images are stored in the **Artifact Registry** (Google's private Docker registry — the modern replacement for Container Registry). That long image name is not random, it's the address of the repository:

```
southamerica-east1-docker.pkg.dev / sleepr-492115 / auth / production
└── region                          └── project ID  └── repo └── image
```

At the end there's `options: logging: CLOUD_LOGGING_ONLY`, which just tells Cloud Build to send the build logs to Cloud Logging instead of trying to write them into a GCS bucket.

### `buildspec.yaml` — Amazon Web Services

This is the equivalent file for **AWS CodeBuild**. Same idea, different flavor: instead of a list of container steps, it's organized into **phases** that run plain shell commands.

```yaml
version: 0.2
phases:
  pre_build:   # authenticate Docker against ECR
    commands:
      - aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-2.amazonaws.com
  build:       # build + tag each image
    commands:
      - docker build -t sleepr/auth -f apps/auth/Dockerfile .
      - docker tag sleepr/auth:latest <account>.dkr.ecr.us-east-2.amazonaws.com/sleepr/auth:latest
  post_build:  # push everything
    commands:
      - docker push <account>.dkr.ecr.us-east-2.amazonaws.com/sleepr/auth:latest
```

The images go to **ECR (Elastic Container Registry)**, which is AWS's private Docker registry.

Two things worth explaining here:

- **`pre_build` exists because of authentication.** You can't push to ECR without logging in first, and the login is a temporary token: `aws ecr get-login-password` generates it and pipes it into `docker login --password-stdin` (piping it instead of passing it as an argument means the token never shows up in the shell history or the build logs).
- **Why `build` and then `tag`?** Locally the image is called `sleepr/auth`, but Docker decides *where* to push based on the image name. So the tag rewrites the name into the full ECR address — same image, second name pointing at the registry. Only then can `post_build` push it.

The two files do the same job, and both of them build from the monorepo root with `-f apps/<service>/Dockerfile .`, exactly like docker-compose does.

---

## Kubernetes: running it on a real cluster

Pushing images to a registry is only half of it — something has to actually **run** them. For that I used a **Kubernetes cluster on both cloud providers**: **GKE** on Google Cloud and **EKS** on AWS.

The AWS cluster is described in `cluster.yaml`, which is an **eksctl** config file:

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
   name: sleepr
   region: us-east-1
nodeGroups:
   - name: ng-1
     instanceType: t2.micro
     desiredCapacity: 3
```

One command (`eksctl create cluster -f cluster.yaml`) and AWS provisions the whole cluster with a node group of 3 EC2 instances. Infrastructure as code — the cluster is defined in a file I can commit, instead of a bunch of clicks in a web console I'd never remember.

Inside the cluster, each microservice becomes:

- a **Deployment** — which pulls the image from the registry (Artifact Registry / ECR), runs it as a Pod and keeps the desired number of replicas alive. If a Pod crashes, Kubernetes restarts it for me.
- one or more **Services** — the stable network address for those Pods. The services here expose both an **HTTP** port and a **TCP** port, because the microservices talk to each other over Nest's TCP transport while still serving normal HTTP requests.
- an **Ingress** — the single public entry point that routes external traffic into the right service.

Sensitive values are **not** hardcoded in the manifests. They're pulled from Kubernetes **Secrets** with `secretKeyRef`:

```yaml
- name: JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: jwt
      key: jwtSecret
```

So the JWT secret and the database connection string live in the cluster, not in the repo. 

---

## Helm: the package manager for Kubernetes

Writing raw Kubernetes YAML gets repetitive *fast* — four services × (deployment + services) and suddenly you're managing a pile of almost-identical files. **Helm** is the tool that packages all of that into a single unit called a **chart**.

The chart lives in `k8s/sleepr`:

```
k8s/sleepr/
├── Chart.yaml        # the chart's identity: name, version, appVersion
├── values.yaml       # the configurable values (image tags, ports, replicas...)
└── templates/        # all the Kubernetes manifests
    ├── auth/         #   deployment.yaml, service-http.yaml, service-tcp.yaml
    ├── reservations/
    ├── payments/
    ├── notifications/
    └── ingress.yaml
```

The simple way to think about it: **`templates/` are the manifests, `values.yaml` is the settings file, and Helm merges the two before sending the result to Kubernetes.** So the same chart can deploy to GCP or to AWS just by changing values — I don't need a duplicated copy of every manifest per environment.

And instead of applying a dozen files one by one, the whole application goes up (or comes down, or gets upgraded) as **one release**:

```bash
helm install sleepr ./k8s/sleepr    # deploy everything
helm upgrade sleepr ./k8s/sleepr    # roll out a new version
helm rollback sleepr                # oops — go back to the previous one
helm uninstall sleepr               # remove the whole app
```

That `rollback` is my favorite part: Helm keeps the history of the releases, so a bad deploy is one command away from being undone. 
