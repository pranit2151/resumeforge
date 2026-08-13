import axios from 'axios';

export interface OtpProvider {
  sendOtp(mobile: string, otp: string): Promise<boolean>;
}

class ConsoleOtpProvider implements OtpProvider {
  async sendOtp(mobile: string, otp: string): Promise<boolean> {
    console.log(`\n==========================================`);
    console.log(`📱 [OTP LOG] Mobile: ${mobile} | OTP: ${otp}`);
    console.log(`==========================================\n`);
    return true;
  }
}

class Msg91OtpProvider implements OtpProvider {
  async sendOtp(mobile: string, otp: string): Promise<boolean> {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      console.warn(`[MSG91 Provider] MSG91_AUTH_KEY missing in .env. Falling back to console log: ${mobile} -> ${otp}`);
      console.log(`📱 [OTP LOG] Mobile: ${mobile} | OTP: ${otp}`);
      return true;
    }

    try {
      // MSG91 API Integration
      await axios.post('https://api.msg91.com/api/v5/otp', {
        template_id: process.env.MSG91_TEMPLATE_ID || 'default_otp',
        mobile: `91${mobile.replace(/^\+91/, '')}`,
        authkey: authKey,
        otp: otp,
      });
      console.log(`[MSG91 Provider] OTP ${otp} successfully sent to ${mobile}`);
      return true;
    } catch (err: any) {
      console.error(`[MSG91 Provider Error] Failed to send OTP to ${mobile}:`, err.message);
      // Log to console so dev never gets blocked
      console.log(`📱 [OTP FALLBACK LOG] Mobile: ${mobile} | OTP: ${otp}`);
      return true;
    }
  }
}

class TwilioOtpProvider implements OtpProvider {
  async sendOtp(mobile: string, otp: string): Promise<boolean> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      console.warn(`[Twilio Provider] Twilio credentials missing in .env. Falling back to console log: ${mobile} -> ${otp}`);
      console.log(`📱 [OTP LOG] Mobile: ${mobile} | OTP: ${otp}`);
      return true;
    }
    console.log(`[Twilio Stub] Sending OTP ${otp} to ${mobile}`);
    return true;
  }
}

export function getOtpProvider(): OtpProvider {
  const providerType = (process.env.OTP_PROVIDER || 'console').toLowerCase();
  if (providerType === 'msg91') {
    return new Msg91OtpProvider();
  }
  if (providerType === 'twilio') {
    return new TwilioOtpProvider();
  }
  return new ConsoleOtpProvider();
}
