import { Resend } from "resend";

let resend = null;

const getResend = () => {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set in environment variables");
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

export const sendAccountCreationEmail = async (
  adminEmail,
  playerEmail,
  playerPassword,
) => {
  try {
    const result = await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: adminEmail,
      subject: "PathQuest Player Account Created",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Player Account Created Successfully</h2>
          <p>Hello Admin,</p>
          <p>A new player account has been created in PathQuest. Here are the credentials:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Email:</strong> ${playerEmail}</p>
            <p><strong>Password:</strong> ${playerPassword}</p>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            Please share these credentials with the player and ensure they change the password on first login.
          </p>
        </div>
      `,
    });

    if (result.error) {
      console.error("Email error:", result.error);
      return { success: false, error: result.error };
    }

    console.log("Email sent successfully:", result.data);
    return { success: true, data: result.data };
  } catch (error) {
    console.error("Email sending failed:", error);
    return { success: false, error: error.message };
  }
};

export const sendPlayerRegistrationConfirmation = async (
  playerEmail,
  playerUsername,
) => {
  try {
    const result = await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: playerEmail,
      subject: "Welcome to PathQuest!",
      html: `
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
    });

    if (result.error) {
      console.error("Email error:", result.error);
      return { success: false, error: result.error };
    }

    console.log("Registration confirmation email sent:", result.data);
    return { success: true, data: result.data };
  } catch (error) {
    console.error("Email sending failed:", error);
    return { success: false, error: error.message };
  }
};
