---
title: Backblaze B2
description: Connect a Backblaze B2 bucket to Fileee.
---

## Create the bucket

Create a private bucket in the Backblaze console. Note its S3 endpoint, which looks like `s3.us-east-005.backblazeb2.com`. The middle part, `us-east-005` here, is the region.

## Create a credential

1. Go to **B2 Cloud Storage > Application Keys** and choose **Add a New Application Key**.
2. Under **Allow Access to Bucket(s)**, choose your bucket.
3. Under **Type of Access**, choose **Read and Write**.
4. Choose **Create New Key**, and copy the key ID and application key. The application key is only shown once.

Use a standard key for one bucket, not the master key. The key ID is Fileee's **Access key ID**, and the application key is its **Secret access key**. See [application keys](https://www.backblaze.com/docs/cloud-storage-create-and-manage-app-keys) for more.

## Connect it

| Field               | Value                                 |
| ------------------- | ------------------------------------- |
| **Provider**        | Backblaze B2                          |
| **Endpoint**        | `https://s3.<region>.backblazeb2.com` |
| **Bucket**          | Your bucket's name                    |
| **Region**          | The region from the endpoint          |
| **Path-style URLs** | Off                                   |

## Allow browser access

B2 supports setting CORS through its S3 API, so try **Apply for me**, then **Test**.

Backblaze doesn't say whether a key limited to one bucket can change CORS rules. If **Apply for me** is refused, [set the rule from the command line](/providers/#set-the-rule-from-the-command-line) with a key that has more access. See [CORS with the S3 API](https://www.backblaze.com/docs/cloud-storage-enable-cors-with-the-s3-compatible-api) for more.

## Public CDN links

Making a bucket public exposes all of it, so you should need a separate bucket for public copies. See [Public CDN links](/deploying/#public-cdn-links).
