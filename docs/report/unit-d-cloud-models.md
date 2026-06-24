# Unit 6 — Unit D Report: Cloud Models & Network Enhancements

**Student:** [Your Name]  
**Unit:** 6 — Networking in the Cloud  
**Assignment:** Task 3 — Cloud Models & Enhancements  

---

## 1. On-Premises vs In-Cloud vs Hybrid (D.P7)

### Definitions

**On-Premises (On-Prem):** All servers, storage, and networking hardware are physically located at the company's premises. The IT team owns, installs, maintains, and upgrades everything.

**In-Cloud:** All computing resources are rented from a cloud provider. The company owns no hardware; everything runs in the provider's data centre.

**Hybrid:** A combination — some systems run on-premises, others in the cloud. They are connected via VPN or dedicated leased lines (e.g., AWS Direct Connect).

### System Recommendations for TechAccessories

| System | Recommended Model | Justification |
|--------|------------------|---------------|
| **ERP** (Enterprise Resource Planning) | Hybrid | ERP contains sensitive financial and operational data. Core processing runs on-premises for data sovereignty; cloud is used for backup and remote access via VPN. A SaaS ERP (e.g., SAP Business ByDesign) is the alternative if the company lacks IT staff. |
| **CRM** (Customer Relationship Management) | In-Cloud (SaaS) | CRM data (customer names, purchase history) benefits from cloud accessibility for sales staff and does not require on-prem infrastructure. SaaS options like HubSpot or Salesforce provide enterprise features without maintenance overhead. |
| **WMS** (Warehouse Management System) | Hybrid | Warehouse operations require real-time, low-latency access to inventory data even if internet connectivity fails. An on-premises WMS with cloud synchronisation ensures warehouse staff can work offline; inventory syncs to the cloud when connectivity is restored. |

### Comparison Table

| Factor | On-Premises | In-Cloud | Hybrid |
|--------|------------|---------|--------|
| Capital cost | High (hardware) | Low (subscription) | Medium |
| Operational cost | High (IT staff) | Low | Medium |
| Scalability | Low (fixed hardware) | High | Moderate |
| Data control | Full | Shared/provider | Split |
| Internet dependency | None | Full | Partial |
| Disaster recovery | Complex | Built-in | Moderate |

---

## 2. IaaS vs PaaS vs SaaS — Appropriate Level Selection

### Definitions (with TechAccessories context)

**IaaS:** The cloud provider supplies virtual machines, storage, and networking. TechAccessories controls the OS, middleware, and applications. Used in this project: Contabo VPS (bare server). Appropriate for: custom infrastructure, full control needed (e.g., running Docker with multiple isolated projects).

**PaaS:** The provider manages OS and runtime. TechAccessories deploys only application code. Example: Heroku for the website, or Google Cloud Run. Appropriate for: developers who want to focus on code, not infrastructure (e.g., a developer deploying the e-commerce site without managing Nginx).

**SaaS:** The provider manages everything. TechAccessories uses the application as-is. Example: Shopify for the store, Xero for accounting. Appropriate for: non-technical management, standard business functions.

### Selection Matrix

| Need | Chosen Model | Reason |
|------|-------------|--------|
| Web hosting (this project) | IaaS | Full control over server environment; Docker + multiple projects on one VPS is cost-effective |
| Email | SaaS (Google Workspace) | No infrastructure to manage; highly reliable; 99.99% uptime SLA |
| E-commerce platform expansion | PaaS | If the site needs a backend (cart, payments), a PaaS like Railway or Render handles scaling automatically |
| Accounting | SaaS (Xero/QuickBooks) | Standardised software; compliance built-in |

---

## 3. Public Cloud vs Private Cloud vs Multi-Cloud

### Definitions

**Public Cloud:** Resources are shared among multiple tenants on the provider's infrastructure (AWS, Azure, GCP, Contabo). Lowest cost, highest scalability. Suitable for internet-facing services with no strict data sovereignty requirements.

**Private Cloud:** Dedicated infrastructure for one organisation, either on-premises or in a leased data centre. Higher cost, full control. Used for sensitive data (medical records, financial transactions) where regulatory compliance (GDPR, PCI-DSS) requires data segregation.

**Multi-Cloud:** Using two or more cloud providers simultaneously. Avoids vendor lock-in; different workloads go to the most cost-effective provider.

### Recommendations by System Confidentiality

| System | Cloud Type | Reason |
|--------|-----------|--------|
| **Website** (ilmora.net) | Public Cloud | No sensitive data; cost-effective; global CDN available |
| **CRM** (customer data) | Public Cloud (with encryption) | GDPR compliance achieved through encryption at rest + strict access controls; SaaS CRM already compliant |
| **ERP** (financial data) | Private Cloud or Hybrid | Financial records require audit trails and data sovereignty; private cloud ensures data never leaves company control |
| **WMS** (inventory) | Public Cloud | Inventory data is sensitive but not regulated; public cloud with VPN access is sufficient |

### Cost Efficiency Analysis

The TechAccessories shop currently uses Contabo (public cloud IaaS) at an estimated cost of €15–30/month for a VPS capable of hosting all services. An equivalent AWS setup (EC2 t3.medium + RDS + ALB) would cost ~$150–200/month — 5–10× more expensive for the same workload, making public cloud IaaS (Contabo) the most cost-efficient choice at this scale.

---

## 4. Virtualisation vs Containerisation (D.P8)

### Virtual Machines (Virtualisation)

A hypervisor (e.g., VMware ESXi, KVM, VirtualBox) creates Virtual Machines (VMs) — each with a full copy of an operating system, virtualised hardware (CPU, RAM, disk), and applications.

**How it works:** The hypervisor partitions the physical server's resources and presents each VM with a virtualised hardware environment. Each VM runs its own OS kernel.

**Resources:** A typical VM: 2 vCPU, 4GB RAM, 20GB disk. Boot time: 30–120 seconds.

**Use case:** Running Windows applications on a Linux server; strong isolation requirements (separate OS kernels); legacy application compatibility.

### Containers (Docker/Kubernetes)

Containers share the host OS kernel. Docker uses **Linux namespaces** (isolation) and **cgroups** (resource limits) to run isolated processes. Each container has its own filesystem, network, and process space but shares the kernel.

**How it works:** `docker run nginx:alpine` pulls the Alpine Linux filesystem + Nginx binary, creates a namespace for it, assigns it a network interface, and starts the Nginx process. No OS to boot.

**Resources:** A typical container: 50–200MB RAM, <10MB disk (Alpine). Start time: <1 second.

**Use case:** Microservices, CI/CD pipelines, any application where fast startup, small footprint, and high density matter.

### Comparison Table

| Factor | Virtual Machines | Containers (Docker) |
|--------|----------------|-------------------|
| OS overhead | Full OS per VM (~1–4GB) | Shared kernel (<100MB) |
| Startup time | 30–120 seconds | <1 second |
| Isolation | Strong (separate kernels) | Process-level (same kernel) |
| Density | 10–20 VMs per server | 100+ containers per server |
| Portability | Image-level (OVA/VMDK) | `docker pull` — universal |
| Resource usage | Fixed allocation | Dynamic (cgroups limits) |
| Best for | Legacy apps, strong isolation | Microservices, CI/CD |

### Kubernetes for Scale

For TechAccessories, as the business grows to require multiple replicas of the shop container, **Kubernetes (K8s)** would orchestrate containers:
- Automatically restart crashed containers
- Scale from 1 to 10 replicas based on CPU load
- Rolling deployments with zero downtime
- Built-in service discovery and load balancing

The current Docker Compose deployment is appropriate for the project's scale (single server, one container). If traffic grows to 10,000+ concurrent users, migrating to Kubernetes on a managed platform (e.g., Google GKE, DigitalOcean Kubernetes) would provide the scaling needed.

---

## 5. Network Enhancements & Justification (D.M4, D.D3)

### Original Design Baseline

Initial deployment served static files via Nginx over HTTPS with no caching layer or performance monitoring.

### Enhancement 1: HTTP Response Caching (Implemented)

**Change:** Added `Cache-Control: public, immutable, max-age=31536000` for static assets in `nginx.conf`.

**Before:** Every CSS/image request hits the server (full round-trip).  
**After:** Browser caches assets for 1 year; repeat visits load from disk cache (~5ms vs ~150ms).

**Test:**
```bash
# First visit (cold cache)
curl -o /dev/null -s -w "%{time_total}s\n" https://ilmora.net/assets/css/style.css
# Expected: ~0.150s

# Second visit (verify cache header)
curl -I https://ilmora.net/assets/css/style.css | grep Cache-Control
# Expected: Cache-Control: public, immutable
```

### Enhancement 2: Gzip Compression (Implemented)

**Change:** Enabled `gzip on` in `nginx.conf` for text/html, text/css, application/javascript.

**Before:** Uncompressed CSS ~8KB, HTML ~25KB per page.  
**After:** CSS ~2.5KB, HTML ~7KB (68% reduction).

**Test:**
```bash
curl -H "Accept-Encoding: gzip" -sI https://ilmora.net/ | grep -i content-encoding
# Expected: content-encoding: gzip
```

**Impact:** Users on mobile connections (3G/4G) see 60–70% faster load times for text content.

### Enhancement 3: Security Headers (Implemented)

**Change:** Added HSTS, X-Frame-Options, X-Content-Type-Options to nginx conf.

**Test (SSL Labs):** Navigate to `https://www.ssllabs.com/ssltest/analyze.html?d=ilmora.net` — expected Grade A.

### Enhancement 4: Health Check Monitoring (Implemented)

**Change:** Docker healthcheck polls `/health` every 30 seconds. If it fails 3 times, Docker marks the container unhealthy and can trigger an alert.

**Test:**
```bash
docker inspect networking-shop --format='{{.State.Health.Status}}'
# Expected: healthy
```

### Enhancement 5: Recommended — CDN Layer (Not Yet Implemented)

**Recommendation (D.P7):** Add Cloudflare as a CDN/WAF in front of the origin server.

**How to implement (D.P8):**
1. Change the `ilmora.net` DNS A record to point to Cloudflare's nameservers instead of the VPS IP directly
2. Enable "Proxied" mode in Cloudflare dashboard
3. Set Cloudflare SSL mode to "Full (strict)"
4. Enable Cloudflare's caching rules for `/assets/*`

**Expected improvement:**
- Static assets served from Cloudflare's 200+ global edge nodes → ~20ms load time for global users (vs ~150ms from Contabo's single location)
- DDoS protection (Cloudflare absorbs attacks before they reach the VPS)
- Hides origin IP (VPS IP is no longer public, preventing direct attacks)

**Justification against original design (D.D3):**

| Metric | Original | With CDN |
|--------|---------|---------|
| UK load time | ~112ms | ~40ms |
| US load time | ~280ms | ~45ms |
| Asia load time | ~450ms | ~35ms |
| DDoS resilience | None | Cloudflare (up to 321 Tbps) |
| SSL management | Manual (cron) | Automatic (Cloudflare) |

The CDN enhancement justifies itself at minimal cost (Cloudflare free tier) with a 3–10× performance improvement for global users, transforming a single-region deployment into a globally distributed delivery network. This directly addresses the constraint of the current architecture: a single VPS in Germany serving global users with increasing latency as distance grows.
