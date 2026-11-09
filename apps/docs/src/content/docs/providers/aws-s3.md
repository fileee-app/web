---
title: AWS S3
description: Connect an Amazon S3 bucket to Fileee.
---

## Create the bucket

In the S3 console, create a general purpose bucket and note its region. Leave public access blocked, because Fileee uses signed URLs.

## Create a credential

Create an IAM user just for Fileee, and give it access to this bucket only.

1. In the IAM console, create a user. It doesn't need console access.
2. Open the user, then go to **Permissions > Add permissions > Create inline policy**.
3. Paste the [policy from Connect a bucket](/installing/#connect-a-bucket), with `YOUR-BUCKET` replaced by your bucket's name.
4. [Create an access key](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html) for the user. The secret is only available when you create it, so copy it then.

## Connect it

| Field               | Value                                |
| ------------------- | ------------------------------------ |
| **Provider**        | AWS S3                               |
| **Bucket**          | Your bucket's name                   |
| **Region**          | Your bucket's region, as `eu-west-1` |
| **Path-style URLs** | Off                                  |

## Allow browser access

Run **Apply for me**, then **Test**. That policy includes the two CORS permissions it needs.

To add the rule by hand, copy it from **How to set up**. In the S3 console, go to **General purpose buckets**, choose your bucket, open **Permissions**, and choose **Edit** under **Cross-origin resource sharing (CORS)**. Paste the rule and choose **Save changes**. See the [AWS guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enabling-cors-examples.html) for more.

## Public CDN links

CloudFront can serve just one prefix, using an origin path and a bucket policy limited to it, so a prefix in the same bucket should work. See [Public CDN links](/deploying/#public-cdn-links).
