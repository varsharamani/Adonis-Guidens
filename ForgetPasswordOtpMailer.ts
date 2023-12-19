import MailHelper from 'App/Helpers/MailHelper';
import User from 'App/Models/User';
import Env from '@ioc:Adonis/Core/Env';
import { BaseMailer, MessageContract } from '@ioc:Adonis/Addons/Mail';

export default class ForgetPasswordOtpMailer extends BaseMailer {
    constructor(private user: User) {
        super();
    }

    public prepare(message: MessageContract) {
        const htmlOutput = new MailHelper(`<mj-column width="100%">
        <mj-text>
          <p>You are receiving this email because we received a password reset request for your account.</p>
          <p>Use below OTP for password reset.</p>
        </mj-text>
        <mj-text width="100%" align="center" font-size="30px" font-weight="500">${this.user.otp}</mj-text>
        <mj-text>
          <p>If you did not request a password reset, no further action is required.</p>
          <p>Thank You.</p>
        </mj-text>
      </mj-column>`).render();
        message
            .from(Env.get('MAIL_FROM'))
            .to(this.user.email)
            .subject('Reset Password')
            .html(htmlOutput);
    }
}
