type BaseEmailConfig = {
  from: string;
  redirectTo?: string;
};

export type SmtpEmailConfig = BaseEmailConfig & {
  provider: 'smtp';
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
  };
};

export type SesEmailConfig = BaseEmailConfig & {
  provider: 'ses';
  ses: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
};

export type EmailConfig = SmtpEmailConfig | SesEmailConfig;
