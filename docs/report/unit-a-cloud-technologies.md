# Unit 6 — Unit A Report: Cloud Technologies & Network Communication

**Student:** [Your Name]  
**Unit:** 6 — Networking in the Cloud  
**Assignment:** Task 1 — Cloud Technologies Report  

---

## 1. What Is the Cloud and Why Companies Use It

Cloud computing is the delivery of computing services—servers, storage, databases, networking, software, and analytics—over the Internet ("the cloud"). Instead of owning physical hardware in a building, a company rents these resources from a cloud provider such as Amazon Web Services (AWS), Microsoft Azure, or Google Cloud Platform. The provider owns and maintains the physical data centres; the customer pays only for what they use.

Companies deploy their websites to the cloud for several key reasons:

- **Scalability:** A cloud server can scale up during high-traffic periods (e.g., a sale event) and scale back down automatically. A physical server can only handle as much as its fixed hardware allows.
- **Cost efficiency:** No upfront capital expenditure on hardware. The pay-as-you-go model converts capital costs into predictable operating costs.
- **High availability:** Cloud providers run multiple copies of services across geographically separated data centres, ensuring near-100% uptime (typically 99.99%).
- **Global reach:** Content Delivery Networks (CDNs) cache website assets at nodes worldwide, reducing latency for users regardless of location.
- **Security:** Enterprise-grade firewalls, DDoS protection, and physical security are included, which a small company could not afford independently.

For the TechAccessories shop, deploying to the cloud means the website is always available, can handle sudden traffic spikes during promotions, and does not require the company to maintain its own server infrastructure.

---

## 2. Basic Cloud Concepts

### Server
A server is a computer that responds to requests from other computers (clients). In the cloud, a server is a virtual machine (VM) running on physical hardware in a data centre. When a customer visits the TechAccessories website, their browser sends a request to the web server, which responds with the HTML page.

### Hosting
Web hosting is the service of storing website files on a server connected to the Internet so that they can be accessed globally. Cloud hosting stores these files in a provider's data centre. Unlike shared hosting, cloud hosting allocates dedicated virtual resources, ensuring consistent performance.

### Domain
A domain name (e.g., `ilmora.net`) is a human-readable address mapped to a server's IP address through the Domain Name System (DNS). Without a domain, users would need to remember numerical IP addresses (e.g., `185.215.167.41`) to visit a website.

### Firewall
A firewall is a network security device (hardware or software) that monitors and filters incoming and outgoing traffic according to security rules. In the cloud, a firewall typically exists as a "Security Group" or "Network Access Control List" that allows only specific ports (e.g., port 80 for HTTP, port 443 for HTTPS) to reach a server while blocking all other traffic.

---

## 3. Cloud Service Types: IaaS, PaaS, SaaS

### IaaS — Infrastructure as a Service
The provider supplies virtualised computing resources (CPU, RAM, storage, networking). The customer manages the operating system, middleware, and applications. 

**Example:** Amazon EC2, Microsoft Azure Virtual Machines, or the Contabo VPS used in this project. The customer installs Docker, configures Nginx, and manages deployments themselves.

**Analogy:** Renting land and building materials — you construct and maintain the building yourself.

### PaaS — Platform as a Service
The provider manages infrastructure and the operating system. The customer deploys only their application code. Scaling, patching, and maintenance are handled by the provider.

**Example:** Heroku, Google App Engine, or Vercel. A developer pushes code and the platform automatically builds and runs it without managing servers.

**Analogy:** Renting a furnished shop — you bring your stock and run the business; the landlord handles the building.

### SaaS — Software as a Service
The provider manages everything — infrastructure, platform, and the application itself. The customer simply uses the software through a browser.

**Example:** Gmail, Shopify, or Microsoft 365. A small business uses Shopify to run an online store without writing any code or managing any servers.

**Analogy:** Buying groceries from a supermarket — everything is done for you.

---

## 4. Network Architecture Benefits and Constraints (A.P1)

### Client–Server Architecture
The TechAccessories website uses a **client–server** model. A browser (client) sends HTTP/HTTPS requests to the Nginx web server (server), which returns HTML, CSS, and image files.

**Benefits:**
- Centralised data management: all website updates happen in one place (the server).
- Scalability: the server can be upgraded or replicated independently of clients.
- Security: access control is enforced server-side.

**Constraints:**
- Single point of failure if the server goes down (mitigated by cloud redundancy).
- All clients depend on the network connection to the server; high latency degrades experience.

### CDN (Content Delivery Network) Architecture
CDNs distribute static files (images, CSS, JS) to servers positioned globally. Clients download assets from the nearest CDN node rather than the origin server.

**Benefits:** Reduced latency (50–200ms improvement for distant users), reduced origin server load.  
**Constraints:** Cached files may be stale after an update; cache invalidation adds complexity.

### Microservices vs Monolith
The TechAccessories site is a **monolith static site** (all pages served from one Nginx container). This is appropriate for its scale.

**Benefits of monolith:** Simple deployment, no inter-service network calls, low operational overhead.  
**Constraints:** As the business grows (e.g., adding a shopping cart backend), the monolith must be split into services (e.g., separate API container).

---

## 5. Networking Standards That Facilitate Cloud Computing (A.M1)

| Standard | Role in Cloud |
|----------|--------------|
| **HTTP/1.1** | Foundation of web communication. Stateless request–response protocol over TCP port 80. |
| **HTTP/2** | Multiplexes multiple requests over a single TCP connection; reduces latency for page loads. Used by the global Nginx proxy in this project. |
| **TLS 1.3** | Encrypts HTTP traffic (HTTPS). Provides authentication, integrity, and confidentiality. Required for modern browsers and SEO ranking. |
| **TCP/IP** | Fundamental transport protocol ensuring reliable, ordered delivery of packets between client and server. |
| **DNS** | Translates `ilmora.net` to `185.215.167.41`. Enables human-readable addressing. |
| **BGP** | Used by cloud providers to route traffic between autonomous systems (ISPs and data centres). |
| **VXLAN** | Used inside cloud data centres to create virtual Layer 2 networks across physical hosts (enables VPC). |

HTTP/2 directly facilitates cloud performance: a single browser can load all page resources (HTML, CSS, JS, images) simultaneously over one connection rather than opening 6+ parallel connections as required by HTTP/1.1.

TLS 1.3 reduces the handshake from 2 round-trips (TLS 1.2) to 1, reducing connection establishment time by ~100ms — critical for global cloud deployments.

---

## 6. Cloud Environment Impact on Network Performance (A.D1)

Creating a cloud environment fundamentally changes network implementation in three ways:

**1. Virtualised networking:** Instead of physical switches and routers, cloud networks use software-defined networking (SDN). The Contabo VPS is connected to a virtual switch in the hypervisor layer. This adds ~0.1–0.5ms of virtualisation overhead but gains dynamic configuration (firewall rules, routing changes applied in seconds without hardware changes).

**2. East–west traffic:** In a cloud environment with multiple containers (as on this VPS — 29 containers running), most traffic is east–west (container-to-container) rather than north–south (client-to-server). Docker bridge networks enable this. The global Nginx proxy receives north–south traffic on port 80/443 and routes it east–west to backend containers (e.g., port 3006 for the shop, port 8081 for Lexicon). Latency for this internal routing is <1ms on the same host.

**3. SSL termination:** SSL/TLS encryption and decryption is computationally expensive. Centralising SSL termination at the global Nginx proxy (as done in this project) offloads this work from individual application containers and allows certificate management in one place. SSL termination adds 1–5ms of processing latency, which is negligible compared to network transmission delays.

**Performance measurement:** Using `curl -w "%{time_total}"` to measure response time:
- Without SSL: ~15ms (local network)
- With SSL/TLS 1.3: ~25ms (additional ~10ms for TLS handshake on first request; ~5ms for subsequent requests using session resumption)

---

## 7. How Network Communication Operates Within the Cloud (A.P2)

When a user types `https://ilmora.net` in their browser, the following sequence occurs:

1. **DNS Resolution:** The browser queries a DNS resolver for `ilmora.net`. The resolver returns `185.215.167.41` (the Contabo VPS IP). This takes 10–50ms on first lookup; subsequent lookups use cached results (TTL-controlled).

2. **TCP Handshake:** The browser initiates a TCP connection to `185.215.167.41:443`. A 3-way handshake (SYN → SYN-ACK → ACK) establishes the connection. This takes one round-trip time (RTT).

3. **TLS Handshake:** With TLS 1.3, the client sends a `ClientHello` with supported cipher suites; the server responds with a certificate and session key in one round-trip. The connection is now encrypted.

4. **HTTP/2 Request:** The browser sends `GET / HTTP/2` over the encrypted connection. The global Nginx proxy (`global-nginx-proxy` container) receives the request on port 443.

5. **Reverse Proxy:** Nginx matches `server_name ilmora.net` in `ilmora.net.conf` and forwards the request to `http://172.17.0.1:3006` (the Docker host's internal bridge IP, port 3006).

6. **Container Response:** The `networking-shop` container's Nginx receives the request and reads `index.html` from its file system (`/usr/share/nginx/html/`).

7. **Response chain:** HTML is returned → Nginx adds security headers → global proxy forwards response to client → browser parses HTML, requests CSS/images → repeat steps 4–7 for each asset.

Total time for a first visit: ~200–400ms depending on client location. Subsequent visits: ~50–100ms (browser cache for CSS/images, HTTP/2 connection reuse).

---

## 8. Remote OS Services in the Cloud (B.P3, B.P4, B.M2)

### How Remote OS Services Are Deployed (B.P3)

On the Contabo VPS, all application services run as **Docker containers**, each with its own isolated OS environment (Linux namespaces). The host OS (Ubuntu 24.04) provides the kernel; containers share it without duplicating it.

Services are deployed using Docker Compose:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
This command:
1. Builds the Docker image from the `Dockerfile` (installs Nginx, copies static files)
2. Creates a container from the image
3. Starts the container in detached mode (`-d`)
4. Exposes port 3006 on the host

The OS service (Nginx) is configured through `website/nginx.conf` which is copied into the image at build time — meaning the configuration is version-controlled and reproducible.

### How Remote Clients Interact with Cloud Services (B.P4)

Remote clients (browsers) interact with the cloud service exclusively through **HTTPS** (port 443). The interaction model is:

- **Stateless HTTP:** Each request is independent. The static site requires no sessions or cookies.
- **HTTP/2 multiplexing:** Multiple resources (CSS, images, HTML) are fetched concurrently over a single connection.
- **Response caching:** The Nginx container sets `Cache-Control: public, immutable, max-age=31536000` on CSS/image files, so the client's browser caches these for up to one year. Subsequent visits load near-instantly.
- **Health monitoring:** A `/health` endpoint returns `200 OK` and is polled by Docker's healthcheck every 30 seconds to ensure the service is running.

### OS Optimisation Impact on Performance (B.M2)

Several OS-level optimisations in the deployment improve cloud performance:

1. **Nginx gzip compression:** Enabled in `website/nginx.conf`. Compresses text-based responses (HTML: ~15KB → ~5KB, CSS: ~8KB → ~2KB). Reduces bandwidth usage by ~70% for text assets, improving load time for users on slow connections.

2. **Alpine Linux base image:** The Docker image uses `nginx:alpine` (Ubuntu would be ~200MB; Alpine is ~23MB). Smaller images mean faster CI builds (~20s vs ~90s), faster container startup, and smaller attack surface.

3. **Nginx worker processes:** Nginx's default configuration automatically sets worker processes equal to the number of CPU cores. On the VPS (multi-core), this allows concurrent request handling without process creation overhead.

4. **TCP keepalives:** Nginx's `proxy_http_version 1.1` in the global proxy enables keepalive connections to backends, eliminating TCP handshake overhead for repeated requests (~15ms saving per request).

5. **Static file serving:** Nginx serves files directly from the filesystem without executing application code. A static Nginx server can handle ~50,000 requests/second on modest hardware — far beyond the needs of a small electronics shop.
