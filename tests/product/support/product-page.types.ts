export interface ProductCredentials {
  readonly phone?: string;
  readonly otpCode?: string;
  readonly email?: string;
  readonly password?: string;
}

/** Details for a fresh self-serve property-owner registration. */
export interface NewCustomerAccount {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string;
}

export interface ProductRuntimeIds {
  projectId?: string;
  quotationId?: string;
  entrepreneurQuotationId?: string;
  token?: string;
}
