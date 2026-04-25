import mailjet from "node-mailjet";

let mailjetClient = null;

const getMailjetClient = () => {
  if (!mailjetClient) {
    if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
      throw new Error(
        "MAILJET_API_KEY and MAILJET_SECRET_KEY are not set in environment variables",
      );
    }
    mailjetClient = mailjet.Client({
      apiKey: process.env.MAILJET_API_KEY,
      apiSecret: process.env.MAILJET_SECRET_KEY,
    });
  }
  return mailjetClient;
};

// Send player credentials directly to the player
export const sendPlayerCredentialsEmail = async (
  playerEmail,
  playerPassword,
) => {
  try {
    const client = getMailjetClient();
    const result = await client.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAILJET_FROM_EMAIL || "noreply@pathquest.com",
            Name: process.env.MAILJET_FROM_NAME || "PathQuest",
          },
          To: [
            {
              Email: playerEmail,
            },
          ],
          Subject: "Your PathQuest Account Credentials",
          HTMLPart: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Welcome to PathQuest!</h2>
              <p>Hello,</p>
              <p>Your PathQuest player account has been created successfully. Here are your login credentials:</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
                <p style="margin: 10px 0;"><strong>Email:</strong> ${playerEmail}</p>
                <p style="margin: 10px 0;"><strong>Password:</strong> ${playerPassword}</p>
              </div>
              
              <p style="color: #666; margin: 20px 0;">
                <strong>Important:</strong> Please log in and change your password immediately on your first login for security purposes.
              </p>
              
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                If you didn't request this account or have any questions, please contact support.
              </p>
              
              <p style="color: #999; font-size: 11px; border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
                © 2026 PathQuest. All rights reserved.
              </p>
            </div>
          `,
        },
      ],
    });

    console.log("Player credentials email sent successfully:", result.body);
    return { success: true, data: result.body };
  } catch (error) {
    console.error("Email sending failed:", error);
    return { success: false, error: error.message };
  }
};

// Send admin notification about account creation
export const sendAccountCreationEmail = async (
  adminEmail,
  playerEmail,
  playerPassword,
) => {
  try {
    const client = getMailjetClient();
    const result = await client.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAILJET_FROM_EMAIL || "noreply@pathquest.com",
            Name: process.env.MAILJET_FROM_NAME || "PathQuest",
          },
          To: [
            {
              Email: adminEmail,
            },
          ],
          Subject: "PathQuest Player Account Created",
          HTMLPart: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Player Account Created Successfully</h2>
              <p>Hello Admin,</p>
              <p>A new player account has been created in PathQuest. Here are the credentials:</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Email:</strong> ${playerEmail}</p>
                <p><strong>Password:</strong> ${playerPassword}</p>
              </div>
              
              <p style="color: #666; font-size: 12px;">
                The player has been sent an email with their account credentials.
              </p>
            </div>
          `,
        },
      ],
    });

    console.log("Admin notification email sent successfully:", result.body);
    return { success: true, data: result.body };
  } catch (error) {
    console.error("Email sending failed:", error);
    return { success: false, error: error.message };
  }
};

// Send registration confirmation to player
export const sendPlayerRegistrationConfirmation = async (
  playerEmail,
  playerUsername,
) => {
  try {
    const client = getMailjetClient();
    const result = await client.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAILJET_FROM_EMAIL || "noreply@pathquest.com",
            Name: process.env.MAILJET_FROM_NAME || "PathQuest",
          },
          To: [
            {
              Email: playerEmail,
            },
          ],
          Subject: "Welcome to PathQuest!",
          HTMLPart: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Welcome to PathQuest!</h2>
              <p>Hello ${playerUsername},</p>
              <p>Your account has been successfully created. You can now log in and start your learning journey.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #666;">Happy learning!</p>
              </div>
              
              <p style="color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
                If you didn't create this account, please contact support immediately.
              </p>
            </div>
          `,
        },
      ],
    });

    console.log("Registration confirmation email sent:", result.body);
    return { success: true, data: result.body };
  } catch (error) {
    console.error("Email sending failed:", error);
    return { success: false, error: error.message };
  }
};
