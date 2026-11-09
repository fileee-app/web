---
title: S3-compatible APIs
description: Connect any storage with an S3-compatible API, and what it has to support.
---

Use the **S3-compatible** option for a self-hosted server or a provider without its own preset. If your provider is on the list in **Settings > Storages**, such as Hetzner, Scaleway, Akamai (Linode), Vultr or OVHcloud, pick that instead, because it fills in the endpoint format.

## What the API has to support

| Capability     | S3 operations                                                                                         | Fileee uses it for                   |
| -------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Listing        | `ListObjectsV2`                                                                                       | Sync and the connection check        |
| Reading        | `GetObject` with range requests, `HeadObject`                                                         | Downloads, previews, video playback  |
| Writing        | `PutObject`                                                                                           | Uploads under 16 MiB                 |
| Multipart      | `CreateMultipartUpload`, `UploadPart`, `ListParts`, `CompleteMultipartUpload`, `AbortMultipartUpload` | Uploads of 16 MiB or more            |
| Copying        | `CopyObject`, `UploadPartCopy`                                                                        | Public CDN links                     |
| Deleting       | `DeleteObject`, `DeleteObjects`                                                                       | Trash, cleanup and connection probes |
| CORS, optional | `GetBucketCors`, `PutBucketCors`                                                                      | Only for **Apply for me**            |

The server also has to:

- **Accept presigned URLs signed with Signature Version 4.** Browsers upload and download with `PUT` and `GET` requests to these URLs.
- **Send CORS headers to browsers,** from a bucket rule or a server-wide setting. [Allow browser access](/providers/#allow-browser-access) has the rule.
- **List new objects straight away, with matching ETags.** The ETag in a listing has to match the one from `HeadObject`, because sync uses it to spot changes.

Fileee doesn't send the newer optional checksum headers, so servers that don't understand them still work.

## Connect it

Create a private bucket and a credential limited to it, if your server has that option. Then fill in the form:

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Provider**        | S3-compatible                                                         |
| **Endpoint**        | The API's base URL, without the bucket name                           |
| **Bucket**          | Your bucket's name                                                    |
| **Region**          | Your provider's region. If it has none, try `us-east-1`               |
| **Path-style URLs** | On if the server expects `host/bucket/key`, off for `bucket.host/key` |

Fileee's server and your users' browsers both connect to the endpoint, so it needs an address that works for both.

The endpoint must use HTTPS and a public address. To use plain HTTP or a private address, see `ALLOW_PRIVATE_ENDPOINTS` in [Configuration](/deploying/#configuration). If Fileee itself is on `https://`, browsers will block requests to an `http://` endpoint.

## Run the checks

**Connection** runs a real round trip under your prefix and stops at the first step that fails:

| Step           | If it fails                                                                              |
| -------------- | ---------------------------------------------------------------------------------------- |
| **list**       | Check the bucket name, region and endpoint, and that the credential can list this bucket |
| **put**        | Give the credential write access                                                         |
| **get**        | Give the credential read access                                                          |
| **listing**    | The server doesn't list new objects straight away, or its ETags don't match              |
| **ranged get** | The server doesn't appear to support range requests, so video playback may fail          |
| **multipart**  | Allow multipart uploads for this credential. Files of 16 MiB or more need them           |
| **copy**       | Allow copying objects for this credential. Public links need it                          |
| **delete**     | Give the credential delete access                                                        |

A signature or connection error on the first step usually means a wrong endpoint, region or **Path-style URLs** setting.

Then run **Browser access (CORS)**. If your server has no per-bucket CORS rules, use its server-wide setting, as [MinIO](/providers/minio/#allow-browser-access) does, and go straight to **Test**.

If you run Fileee from source, the [conformance script](/developing/#test-a-storage-provider) runs the same test from the command line, and can also check a CDN.

## Public CDN links

Use a separate bucket unless your CDN can be limited to one prefix. See [Public CDN links](/deploying/#public-cdn-links).
