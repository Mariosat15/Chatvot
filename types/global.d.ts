declare global {
  type SignInFormData = {
    email: string;
    password: string;
  };

  type SignUpFormData = {
    fullName: string;
    /** Public identity shown to other players; unique, case-insensitive. */
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    country: string;
    address: string;
    city: string;
    postalCode: string;
    /** ISO 3166-1 alpha-2 for the phone dial code (may differ from residence country). */
    phoneCountry: string;
    /** National digits as typed; server normalises to E.164 with phoneCountry. */
    phoneNational: string;
    /** Q16 — trading | games | both. Informational; not a permission. */
    signupInterest?: "trading" | "games" | "both";
  };

  type CountrySelectProps = {
    name: string;
    label: string;
    control: Control;
    error?: FieldError;
    required?: boolean;
  };

  type FormInputProps = {
    name: string;
    label: string;
    placeholder: string;
    type?: string;
    register: UseFormRegister;
    error?: FieldError;
    validation?: RegisterOptions;
    disabled?: boolean;
    value?: string;
  };

  type Option = {
    value: string;
    label: string;
  };

  type SelectFieldProps = {
    name: string;
    label: string;
    placeholder: string;
    options: readonly Option[];
    control: Control;
    error?: FieldError;
    required?: boolean;
  };

  type FooterLinkProps = {
    text: string;
    linkText: string;
    href: string;
  };

  type WelcomeEmailData = {
    email: string;
    name: string;
    intro: string;
  };

  type User = {
    id: string;
    name: string;
    email: string;
  };

  type StockDetailsPageProps = {
    params: Promise<{
      symbol: string;
    }>;
  };
}

export {};
