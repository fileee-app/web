---
title: Wasabi
description: Connect a Wasabi bucket to Fileee.
---

## Create the bucket

In the Wasabi console, use **Create Bucket**, and enter a name and region. Leave public access off.

## Create a credential

Wasabi access keys belong to a user, so limit access by giving a separate user a policy.

1. Create a sub-user for Fileee.
2. In the **Policies** panel, choose **Create Policy** and paste the [policy from Connect a bucket](/installing/#connect-a-bucket), with `YOUR-BUCKET` replaced by your bucket's name. Attach it to the sub-user.
3. In the **Access Keys** menu, choose **Create Access Key**, then **Sub-User**, and pick your user. Choose **Create**, then **Show** to see the secret.

See [creating a policy](https://docs.wasabi.com/docs/creating-a-policy) and [creating an access key](https://docs.wasabi.com/docs/creating-a-new-access-key) for more.

## Connect it

| Field               | Value                                |
| ------------------- | ------------------------------------ |
| **Provider**        | Wasabi                               |
| **Endpoint**        | `https://s3.<region>.wasabisys.com`  |
| **Bucket**          | Your bucket's name                   |
| **Region**          | Your bucket's region, as `us-west-1` |
| **Path-style URLs** | Off                                  |

## Allow browser access

Add the rule by hand:

1. Copy the rule from **How to set up**.
2. Open the bucket's **Settings**, then the **Permissions** tab, and choose **Cross-Origin Resource Sharing (CORS)** at the bottom.
3. Choose **Edit**, paste the rule, and save.
4. Run **Test** in Fileee.

Wasabi warns that its CORS "does not perform full CORS validation" for some requests, so rely on **Test** rather than the rule alone. See [Wasabi's CORS docs](https://docs.wasabi.com/docs/cross-origin-resource-sharing-cors) for more.

## Public CDN links

Public access is usually set per bucket, so plan on a separate bucket for public copies. See [Public CDN links](/deploying/#public-cdn-links).
