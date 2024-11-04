# 🤝 Let's Be Friends

# Self Hosting Topics

## Appwrite Account

To get started with your Appwrite account:

```bash
# Login with appwrite cli
appwrite client --endpoint http://localhost/v1

# Build the project for production
npm appwrite
```

## Appwrite Config ⚠️ Important

Initialize your project with the following steps:

```bash
# Start in a new folder then run
appwrite init project
```

📝 For more detailed information on configuration, please refer to the provided video guide.

## Appwrite Functions

For a complete guide on setting up and using Appwrite functions, please watch our tutorial video:
[Appwrite Functions Tutorial](https://www.youtube.com/watch?v=GMwrHds4Oa8)

> **Note**: Before deploying this project, please ensure you've completed all the setup steps mentioned above.

---

## 🛠 Deployment Notes

To ensure that emails are sent successfully from your application, you need to configure an **SMTP provider** in **Appwrite**.

We recommend using **Postmark** as the SMTP provider for reliable transactional email service.

### Recommended SMTP Provider:

- **Postmark**: [Get started here](https://postmarkapp.com/)

### 📧 SMTP Configuration in Appwrite

1. **Sign up for a Postmark account**.
2. **Configure Postmark**:
   - Use the SMTP credentials from Postmark.
   - Set up the following in the Appwrite Console under **Settings** > **SMTP**:
     - **SMTP Server Host**: `smtp.postmarkapp.com`
     - **SMTP Port**: `587` (for TLS)
     - **Username**: Your Postmark API token
     - **Password**: Leave this blank (Postmark only requires the API token as the username)
3. **Save** the configuration.

For more details on Postmark's SMTP settings, check out the [Postmark SMTP documentation](https://postmarkapp.com/developer/user-guide/smtp).

---

⚠️ **Note**: If you do not configure an SMTP provider, your app might fail to send important transactional emails.

---

That's it! Now you're ready to deploy your app.

---

### 💡 Need Help?

If you encounter any issues or have questions during the setup, feel free to reach out!
