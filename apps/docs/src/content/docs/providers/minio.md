---
title: MinIO
description: Connect a self-hosted MinIO server to Fileee.
---

Before you start, make sure of these three things:

- **Both sides can reach it.** Fileee's server and your users' browsers both connect to the endpoint, so it needs an address that works for both. `localhost` usually doesn't when Fileee runs in Docker, because there it means the container.
- **Private addresses are allowed.** An endpoint on a private address or plain HTTP is refused unless you add `ALLOW_PRIVATE_ENDPOINTS: "true"` to `environment` in `docker-compose.yml`. This applies to every user, so [only set it if you trust them](/security/#server-side-requests).
- **HTTPS matches.** If Fileee is on `https://`, browsers will block requests to an `http://` MinIO. Put MinIO behind HTTPS too.

## Create the bucket and credential

With the [`mc` client](https://docs.min.io/aistor/reference/cli/admin/) set up under an alias such as `local`, create the bucket:

```bash
mc mb local/fileee
```

Save this as `fileee-policy.json`, with your bucket's name if it's different:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::fileee"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::fileee/*"
    }
  ]
}
```

Then create a user with only that access. Choose your own secret.

```bash
mc admin policy create local fileee-access fileee-policy.json
mc admin user add local fileee YOUR-SECRET
mc admin policy attach local fileee-access --user fileee
```

## Connect it

| Field                 | Value                                      |
| --------------------- | ------------------------------------------ |
| **Provider**          | MinIO                                      |
| **Endpoint**          | Your server's URL, reachable by both sides |
| **Bucket**            | `fileee`                                   |
| **Region**            | `us-east-1`                                |
| **Access key ID**     | The user name, `fileee` here               |
| **Secret access key** | The secret you chose                       |
| **Path-style URLs**   | On                                         |

## Allow browser access

MinIO's CORS is normally set for the whole server through `MINIO_API_CORS_ALLOW_ORIGIN`, which defaults to all origins. Set it to your `APP_URL` to allow only Fileee:

```bash
MINIO_API_CORS_ALLOW_ORIGIN=https://files.example.com
```

**Apply for me** isn't needed, so go straight to **Test**. MinIO AIStor also has [per-bucket rules through `mc cors set`](https://docs.min.io/aistor/reference/cli/mc-cors/).

## Public CDN links

A reverse proxy or an anonymous policy can be limited to one prefix, so a prefix in the same bucket should work. See [Public CDN links](/deploying/#public-cdn-links).
