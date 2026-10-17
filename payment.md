
Description of the Programming Interface (API) 
1. Purpose of the programming interface (API) 
The programming interface (API) allows you to interact with the platform to perform the following actions. 
1. Initiation of transaction to the user of the platform. 
2. Obtaining information about payments (tips) to the user of the platform. 
2. Requirements for the calling system 
To connect an external system to the platform, follow these steps. 
1. Inform the platform administration about the connecting system, and if the application is approved, receive 
the parameters ClientId and ClientSecret, which will be used to identify the connecting system and 
authenticate requests to the program interface. 
2. Provide PaymentCallbackUrl - URL of the method for receiving notifications about the status of payments (if 
it is required to receive callback notifications). 
3. General information about the programming interface (API) 
Interaction protocol: HTTPS. 
Data presentation format: JSON. 
In case of successful request, an HTTP response with a 200 code and the result of the operation in the response body 
is returned. 
In case of an error, an HTTP response is returned with a code value greater than or equal to 400 and the following 
data structure in the response body describing the reason for the error. 
{ 
} 
code: number;    
error: string;  
Error codes description: 
Error code 
Description 
// error code 
// textual description of the error 
1 
5 
6 
50 
51 
200 
201 
202 
203 
204 
205 
206 
Authentication failed or access denied 
X-Api-Signature verification failed 
Request header X-Api-RequestDate is out of date 
Beneficiary URL required 
Beneficiary URL is of incorrect format or invalid 
Creating payments not allowed for the specified ClientID 
Card payments not allowed for the specified ClientID 
Card payments not allowed for the recipient 
Payment with the specified payment_id already processed 
Card number (PAN) is of incorrect format or invalid 
Card expiration date is of incorrect format or invalid 
Card cvv/cvc2 is of incorrect format or invalid 
207 
208 
209 
210 
211 
212 
Cardholder name is of incorrect format or invalid 
Payer email is of incorrect format or invalid 
Unsupported card. Try another one 
URL not allowed 
Payer country not allowed 
Amount not allowed 
Error code 
1000 
Description 
General error code in case it is not described in the error code list. Details are sent in the 
error_message field 
4. Authorization 
To access the API the calling system is required to identify and authenticate itself. 
Identification is performed using the ClientId value previously issued to the calling system. 
Authentication is performed using the ClientSecret value previously issued to the calling system. 
The ClientId and ClientSecret sparameters are passed in the GET parameters of the same name, or are used to form 
the values of additional HTTP headers X-Api-ClientId and X-Api-Signature. 
5. Programming interface methods (API) 
5.1. Payments 
5.1.1 Create payment 
The payment creation method generates an identifier of the payment and the URL for redirecting user to the web 
form with available payment methods. 
HTTP request method 
 
POST 
 
URL 
 
https://api.7995-endpoint-b.com/api/v2/payments 
 
HTTP request headers 
 
X-Api-ClientId contains ClientId. 
X-Api-RequestDate contains the date and time in ISO8601 when the request was generated. 
X-Api-Signature contains a checksum of the content of the HTTP request body according to the formula 
SHA-512(ClientId+X-Api-RequestDate+ClientSecret), that is, SHA-512 (HASH) is calculated from the concatenation 
of the ClientId value, the date and time value and the ClientSecret value of the system creating the payment. 
 
HTTP request body 
 
{  
        user_id: string,             // Unique identifier of the payment receiving platform member  
   amount: number,     // Payment amount 
   currency: string,    // Payment currency in ISO 4217 format (e.g., EUR) 
   message: string; 
   success_url: string, //  URL of the webpage user will be redirected to in case of successful payment 
   fail_url: string,           //  URL of the webpage user will be redirected to in case of failure 
   recurring: bool,            //  if true, monthly payment is created (not applicable for host to host bank card payment) 
   commission_included: bool,   //  if true, payment commission fee will be subtracted from the specified payment amount 
        timeout: int,  // payment expiration time (in minutes), payment will be automatically declined  
    // after the specified number of minutes have passed if it’s not payed by the payer, 
    //  if the value is not specified, default timeout value is applied (1 hour) 
   additional_data: string, // any additional data that will appear everywhere as a part of payment data, 
                                                                          // maximum length is 100 symbols 
   beneficiary_url: string //  URL of the beneficiary website where the payment link is fired 
} 
 
Return value 
 
{ 
   data: { 
 payment_url: string;       // URL of the web form with the available payment methods 
 payment_id: string;        // payment identifier 
 user_id: string;                // payment receiving platform member identifier 
   } 
} 
 
Error result 
 
In case of an error, a response will be returned in accordance with the description in section “3. General 
information about the programming interface (API) ". 
 
 
5.1.2 Host to host bankcard payment 
Host to host bankcard payment method is used to pass bankcard data directly from the calling system to the method 
input parameters when paying the previously created by the “Create payment” method payment without targeting 
user to the payment method selection web form.  
As a result, the paying user is to be redirected to the payment confirmation web page, URL of which will be return in 
case of the method executed successfully. 
HTTP request method 
 
POST 
 
URL 
 
https://api.7995-endpoint-b.com/api/v2/payments/card 
 
HTTP request headers 
 
X-Api-ClientId contains ClientId. 
X-Api-RequestDate contains the date and time in ISO8601 when the request was generated. 
X-Api-Signature contains a checksum of the content of the HTTP request body according to the formula 
SHA-512(ClientId+X-Api-RequestDate+ClientSecret), that is, SHA-512 (HASH) is calculated from the concatenation 
of the ClientId value, the date and time value and the ClientSecret value of the system creating the payment. 
 
HTTP request body 
 
{  
        payment_id: string,           // Payment identifier returned by the “Create payment” method, mandatory 
   card_number: string,  // Bankcard number (PAN), string containing 12…19 digits, mandatory, 
   validity_month: string,// Bankcard expiration month, string containing number from 1 to 12, mandatory, 
   validity_year: string, // Bankcard expiration year, string containing number from 22 to 99, mandatory 
   verification_code: string, // Bankcard verification code (cvv/cvc2), mandatory 
   cardholder_name: string,   // cardholder name, string of Latin characters, mandatory 
   payer_email: string,   // payer email, mandatory 
   display_language: string  // confirmation page  language in ISSO 639-1 format (e.g., en-US), optional, 
    // if not specified the confirmation page will be in English 
} 
 
Return value 
 
{ 
   data: { 
 payment_url: string;       // URL of the web form with the available payment methods 
 payment_id: string;        // payment identifier 
 user_id: string;                // payment receiving platform member identifier 
   } 
} 
 
Error result 
 
In case of an error, a response will be returned in accordance with the description in section “3. General 
information about the programming interface (API) ". 
 
 
5.1.3 Obtaining payment status 
The method for getting information about payments returns a list of payment data blocks that were previously 
created by the calling system, starting with the latest. 
HTTP request method 
 
GET 
 
URL 
 
https://api.7995-endpoint-b.com/api/v2/payments?payment_ids=<id1>,<id2>… 
 
Query string parameters 
 
<id1>,<id2>… — comma-separated list of payment identifiers (payment_id) of the payments to be returned in the 
list, maximum 20 payment identifiers can be passed. 
 
HTTP request headers 
 
X-Api-ClientId contains ClientId. 
X-Api-RequestDate contains the date and time in ISO8601 when the request was generated. 
X-Api-Signature contains a checksum of the content of the HTTP request body according to the formula 
SHA-512(ClientId+X-Api-RequestDate+ClientSecret), that is, SHA-512 (HASH) is calculated from the concatenation 
of the ClientId value, the date and time value and the ClientSecret value of the system creating the payment. 
 
HTTP request body 
 
Empty 
 
Return value 
 
{ 
   data: [{ 
                user_id: string,               // Unique identifier of the payment receiving platform member 
      sender: string,                 // Sender’s nickname 
      payment_id: string,   // Payment identifier 
      amount: number,                // Payment amount 
      currency: string,           // Payment currency in ISO 4217 format (e.g., EUR) 
      message: string,     // Sender’s message 
      date: string,                     // Payment date and time in ISO8601 format 
          recurring: bool,             //  Whether the payment is a recurring (monthly) payment 
           commission_included: bool,   //  Whether the payment commission fee is subtracted from the payment amount 
           additional_data: string, // Additional parameters passed when the payment was created 
                transaction_id: string,  // Payment internal transaction identifier 
                transaction_status_code: number, // Payment status:  
 //  -1 — DECLINED 
                 // 0 —NEW 
 // 1 —PROCESSING 
 // 2 —COMPLETED 
      transaction_status_text: string, // Payment status text 
      transaction_status_data: string, // Payment decline reason if the payment was declined 
      payment_method_id: string,  // Payment method identifier 
      payment_method_name: string, // Payment method name 
      payment_method_data: string, // Payment method data 
      payer_ip: string,  // Payer IP-address 
      payer_country: string, // Payer country (by IP-address; in ISO 3166-1 alpha-2 format) 
      payer_email: string,  // Payer email 
  }], 
  total: number;                                // Total number of payments (starting from after_date, if passed) 
  response_date: string;           // Server date and time in ISO8601 format 
} 
 
Error result 
 
In case of an error, a response will be returned in accordance with the description in section “3. General 
information about the programming interface (API) ". 
 
 
6. Postback notifications (callbacks) 
6.1 General information 
Notifications are sent as HTTP(S) POST requests with Content-Type: application/json. 
Additional HTTP header X-Signature contains a checksum of the content of the HTTP request body according to the 
formula SHA-512(ClientId+body+ClientSecret), that is, SHA-512 (HASH) is calculated from the concatenation of the 
ClientId value, the notification request body and the ClientSecret value of the system creating the payment. 
The checksum must be verified by a checksum calculation on the recipient side and comparing it with the checksum 
passed in the header. Equality of specified values will confirm that the content of the request is unchanged during 
transmission. 
A notification is considered delivered if a response with an HTTP 200 OK status was received in response to the 
request. 
6.2 Payment status change notifications 
A notification about a change in the payment status is sent to the external system by sending an HTTP POST request 
to the PaymentCallbackUrl URL. 
HTTP request body contains the following data. 
{ 
   data: { 
      user_id: string,     // Unique identifier of the payment receiving platform member 
      sender: string,      // Sender’s nickname 
      payment_id: string,  // Payment identifier 
      amount: number,      // Payment amount 
      currency: string,    // Payment currency in ISO 4217 format (e.g., EUR) 
      message: string,     // Sender’s message 
      date: string,        // Payment date and time in ISO8601 format 
      recurring: bool,     //  Whether the payment is a recurring (monthly) payment 
      commission_included: bool, //  Whether the payment commission fee is subtracted from the payment amount 
      additional_data: string, // Additional parameters passed when the payment was created 
      transaction_id: string,  // Payment internal transaction identifier 
      transaction_status_code: number, // Payment status:  
      //  -1 — DECLINED 
                       // 0 —NEW 
      // 1 —PROCESSING 
      // 2 —COMPLETED 
      transaction_status_text: string, // Payment status text 
      transaction_status_data: string, // Payment decline reason if the payment was declined 
      payment_method_id: string,  // Payment method identifier 
      payment_method_name: string, // Payment method name 
      payment_method_data: string, // Payment method data 
      payer_ip: string,  // Payer IP-address 
      payer_country: string, // Payer country (by IP-address; in ISO 3166-1 alpha-2 format) 
      payer_email: string,  // Payer email 
   } 
}