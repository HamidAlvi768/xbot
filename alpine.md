The error you're facing is due to **package version conflicts** in your Alpine-based Docker image. Specifically:

```
python3-dev-3.8.10-r0:
  breaks: build_dependencies[python3-dev=3.8.5-r0]
```

You're requesting `python3-dev=3.8.5-r0`, but Alpine's package index only provides `python3-dev=3.8.10-r0`, which causes a **version conflict**.

---

### ✅ **Solution: Remove strict version pinning**

Instead of specifying **exact versions** like `python3-dev=3.8.5-r0`, you should **remove version constraints** unless you absolutely need them. Let Alpine resolve compatible versions.

#### 🔧 Fix your Dockerfile like this:

```dockerfile
RUN apk --no-cache add --virtual build_dependencies \
    alpine-sdk \
    libc-dev \
    libressl-dev \
    libffi-dev \
    python3-dev
```

If you're trying to build for Alpine v3.12 specifically and must use pinned versions, you must make sure all packages exist in that version — which is hard to maintain because package versions are frequently updated or removed from mirrors.

---

### ✅ Optional: Use a pinned Python version via pyenv or prebuilt Python

If you **need a specific Python version** (like 3.8.5), consider:

* Using `pyenv` to install it.
* Or using a base image like `python:3.8-alpine` instead of `alpine`.

Example:

```dockerfile
FROM python:3.8-alpine

RUN apk add --no-cache \
    alpine-sdk \
    libressl-dev \
    libffi-dev \
    python3-dev \
    libc-dev
```

---

Let me know your use case (e.g., why you’re pinning those versions), and I can tailor a Dockerfile exactly for your setup.
