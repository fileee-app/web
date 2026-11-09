---
title: DigitalOcean Spaces
description: Connect a DigitalOcean Spaces bucket to Fileee.
---

## Create the bucket

Create a Spaces bucket in the DigitalOcean control panel and note its region, such as `nyc3`.

## Create a credential

1. Go to **Spaces Object Storage**, open the **Access Keys** tab, and choose **Create Access Key**.
2. Under **Select access scope**, choose **Limited access**.
3. Pick your bucket and set **Permissions** to **Read/Write/Delete**.
4. Name the key, create it, and copy the access key and secret.

See [manage access](https://docs.digitalocean.com/products/spaces/how-to/manage-access/) for more.

## Connect it

| Field               | Value                                     |
| ------------------- | ----------------------------------------- |
| **Provider**        | DigitalOcean Spaces                       |
| **Endpoint**        | `https://<region>.digitaloceanspaces.com` |
| **Bucket**          | Your bucket's name                        |
| **Region**          | Your bucket's region                      |
| **Path-style URLs** | Off                                       |

Use the regional endpoint. The address on the bucket's page starts with the bucket's name, and Fileee adds that itself.

## Allow browser access

DigitalOcean only describes **Full access** keys as able to change CORS, so expect **Apply for me** to be refused with a limited key. You have two other options.

**The control panel.** Go to **Spaces Object Storage**, open the **Buckets** tab, choose your bucket, and open **Settings**. Under **CORS Configurations**, choose **Add**. Enter your `APP_URL` as the origin, allow `GET`, `PUT` and `HEAD`, add `*` as an allowed header, and save.

The form has no field for exposed headers, which Fileee uses to load large PDFs piece by piece.

**The command line.** To set the complete rule, [use the AWS CLI](/providers/#set-the-rule-from-the-command-line) with a temporary **Full access** key, then delete that key.

Run **Test** in Fileee afterwards. If you use the Spaces CDN, purge it after changing CORS. See [Configure CORS](https://docs.digitalocean.com/products/spaces/how-to/configure-cors/) for more.

## Public CDN links

Public access is usually set per bucket, so plan on a separate bucket for public copies. See [Public CDN links](/deploying/#public-cdn-links).
