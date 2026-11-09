---
title: Storage providers
description: Connect any S3-compatible bucket to Fileee.
---

Fileee works with any storage that speaks the S3 API. Connecting one takes the same four steps everywhere:

1. Create a private bucket.
2. Create a credential limited to that bucket.
3. In **Settings > Storages**, add a storage and pick your provider.
4. Run the **Connection** and **Browser access (CORS)** checks.

These pages cover the provider-specific parts:

- [AWS S3](/providers/aws-s3/)
- [Cloudflare R2](/providers/cloudflare-r2/)
- [Backblaze B2](/providers/backblaze-b2/)
- [Wasabi](/providers/wasabi/)
- [Tigris](/providers/tigris/)
- [DigitalOcean Spaces](/providers/digitalocean-spaces/)
- [MinIO](/providers/minio/)
- [S3-compatible APIs](/providers/s3-compatible/), for anything else, including what the API has to support

Fileee also has presets for Hetzner, Scaleway, Akamai (Linode), Vultr and OVHcloud. For those, follow the steps on this page and take the endpoint format from [Connect a bucket](/installing/#connect-a-bucket).

Provider consoles change often. If a label here doesn't match what you see, the linked provider docs have the current steps.

## Fill in the form

| Field                 | What to enter                                                        |
| --------------------- | -------------------------------------------------------------------- |
| **Provider**          | Your provider. This fills in what it can                             |
| **Name**              | Anything you like. It appears in the sidebar                         |
| **Endpoint**          | The provider's S3 URL, without the bucket name. Not shown for AWS S3 |
| **Bucket**            | The bucket's name                                                    |
| **Region**            | The bucket's region                                                  |
| **Prefix**            | Optional. Fileee only touches objects under this path                |
| **Access key ID**     | From the credential you created                                      |
| **Secret access key** | From the credential you created. It's encrypted before it's stored   |
| **Path-style URLs**   | On for MinIO and some self-hosted servers. Off for hosted providers  |

## Allow browser access

Uploads, downloads and previews go directly between the browser and the bucket, so the bucket has to allow your Fileee address through a CORS rule. In **Check connection**, the **Browser access (CORS)** section offers three buttons:

- **Apply for me** adds the rule, keeping any others on the bucket. The credential has to be allowed to change bucket settings, which a key limited to objects usually isn't.
- **How to set up** shows the rule and an IAM policy, with your address and bucket filled in.
- **Test** tries a real upload from your browser. It's the check that counts.

The rule looks like this, with your `APP_URL` as the origin:

```json
[
  {
    "AllowedOrigins": ["https://files.example.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Accept-Ranges", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 3600
  }
]
```

If you [change the address](/deploying/#change-the-address) later, update the rule too.

### Set the rule from the command line

If your provider's console can't take the whole rule and **Apply for me** is refused, the AWS CLI works with most providers. Save this as `cors.json`:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://files.example.com"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Accept-Ranges", "Content-Length", "Content-Range"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

Then run this with a credential that can change bucket settings. Fileee doesn't need to keep that credential.

```bash
aws s3api put-bucket-cors --endpoint-url https://YOUR-ENDPOINT --bucket YOUR-BUCKET --cors-configuration file://cors.json
```

## Public CDN links

These are optional. The CDN must be able to reach only the public location, so most providers need a separate public bucket. See [Public CDN links](/deploying/#public-cdn-links). Fileee's safety check is what decides whether a setup is allowed.
