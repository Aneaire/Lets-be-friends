# 🤝 Let's Be Friends

Before you deploy this project, please take note of the following important setup step:

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
