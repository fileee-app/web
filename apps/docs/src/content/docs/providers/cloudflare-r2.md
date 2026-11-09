---
title: Cloudflare R2
description: Connect a Cloudflare R2 bucket to Fileee.
---

## Create the bucket

Create a bucket under **R2 object storage** in the Cloudflare dashboard. Leave public access off.

## Create a credential

1. On the **R2 object storage** page, open **Overview**. Under **Account Details**, choose **Manage** next to **API Tokens**.
2. Choose **Create Account API token** or **Create User API token**.
3. Under **Permissions**, choose **Object Read & Write**, and limit the token to your bucket.
4. Copy the **Access Key ID** and **Secret Access Key**.

Cloudflare's [token docs](https://developers.cloudflare.com/r2/api/tokens/) describe each permission.

## Connect it

| Field               | Value                                           |
| ------------------- | ----------------------------------------------- |
| **Provider**        | Cloudflare R2                                   |
| **Endpoint**        | `https://<account id>.r2.cloudflarestorage.com` |
| **Bucket**          | Your bucket's name                              |
| **Region**          | `auto`                                          |
| **Path-style URLs** | Off                                             |

A bucket in a jurisdiction uses that jurisdiction's endpoint, for example `https://<account id>.eu.r2.cloudflarestorage.com`.

## Allow browser access

Add the rule by hand. Cloudflare only describes its **Admin Read & Write** permission as able to change bucket settings, so expect **Apply for me** to be refused with an **Object Read & Write** token.

1. Copy the rule from **How to set up**.
2. In the dashboard, open your bucket, go to **Settings**, and choose **Add CORS policy** under **CORS Policy**.
3. Open the **JSON** tab, paste the rule, and save.
4. Run **Test** in Fileee. A change can take up to 30 seconds to apply.

See [Configure CORS](https://developers.cloudflare.com/r2/buckets/cors/) for more.

## Public CDN links

A custom domain exposes the whole bucket, so you should need a separate bucket for public copies. See [Public CDN links](/deploying/#public-cdn-links).
