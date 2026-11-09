---
title: Tigris
description: Connect a Tigris bucket to Fileee.
---

## Create the bucket

Go to [storage.new](https://storage.new), enter a bucket name, choose the location and default tier, and choose **Create Bucket**.

## Create a credential

1. In the [Tigris console](https://console.storage.dev), open **Access Keys** and choose **Create New Access Key**.
2. Enter a **Key Name**, pick your bucket, and choose a role. **Editor** is the simplest, because it can also set the CORS rule through **Apply for me**. **ReadWrite** can read and write files, but you'd add the CORS rule yourself.
3. Copy the **Access Key ID** and **Secret Access Key**. The secret is only shown once.

By default, a new key can also create and list buckets across your organization. Turn off **Default allowed operations** if you don't want that. See [manage access keys](https://www.tigrisdata.com/docs/iam/manage-access-key/) for more.

## Connect it

| Field               | Value                    |
| ------------------- | ------------------------ |
| **Provider**        | Tigris                   |
| **Endpoint**        | `https://t3.storage.dev` |
| **Bucket**          | Your bucket's name       |
| **Region**          | `auto`                   |
| **Path-style URLs** | Off                      |

If the connection check reports `AccessDenied`, check that the key has a role on this bucket.

## Allow browser access

With an **Editor** key, run **Apply for me**, then **Test**.

With a **ReadWrite** key, copy the rule from **How to set up** and add it in the Tigris dashboard, or [set it from the command line](/providers/#set-the-rule-from-the-command-line) with a key that can change bucket settings. Then run **Test**. See [Tigris's CORS docs](https://www.tigrisdata.com/docs/buckets/cors/) for more.

## Optional: use an IAM policy

You don't need an IAM policy, because the role on the key is enough. If you already manage access through IAM policies, you can attach one to the key:

1. Copy the policy from **How to set up**, or use the one in [Connect a bucket](/installing/#connect-a-bucket) with your bucket's name.
2. In the [Tigris console](https://console.storage.dev), open **IAM Policies**, choose **Create New IAM Policy**, and paste the policy into the **JSON Editor**.
3. Choose **Manage IAM Policy** next to the policy, open **Linked Access Keys**, and choose **+ Link** to add your key.

See [attach an IAM policy](https://www.tigrisdata.com/docs/iam/policies/attach-iam-policy/) for more.

## Public CDN links

Public access is usually set per bucket, so plan on a separate bucket for public copies. See [Public CDN links](/deploying/#public-cdn-links).
