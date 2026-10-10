Description of the Programming Interface 
(API) for making refunds 
1. Purpose of the programming interface (API) 
The programming interface (API) allows you to interact with the platform to perform the following actions. 
1. Making partial or full refund to the user of the platform. 
2. Obtaining information about refunds. 
2. Requirements for the calling system 
To connect an external system to the platform, follow these steps. 
1. Inform the platform administration about the connecting system, and if the application is approved, receive 
the parameters ClientId and ClientSecret, which will be used to identify the connecting system and 
authenticate requests to the program interface. 
2. Provide RefundCallbackUrl - URL of the method for receiving notifications about the status of refunds (if it is 
required to receive callback notifications). 
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
error_message: string;  
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
206 
207 
208 
209 
301 
302 
Card cvv/cvc2 is of incorrect format or invalid 
Cardholder name is of incorrect format or invalid 
Payer email is of incorrect format or invalid 
Unsupported card. Try another one 
Refunds not allowed for the specified ClientID 
Source transaction not found or failed 
Error code 
303 
304 
305 
306 
1000 
Description 
Total amount is already refunded 
The requested amount is greater than available for refunding 
Previous refund for the specified payment is still in progress. Try again later 
Unable to refund. Please contact support 
Общий код ошибки для случаев, если ошибка не описана в списке кодов ошибок. 
Подробности передаются в поле error_message. 
4. Authorization 
To access the API the calling system is required to identify and authenticate itself. 
Identification is performed using the ClientId value previously issued to the calling system. 
Authentication is performed using the ClientSecret value previously issued to the calling system. 
The ClientId and ClientSecret sparameters are passed in the GET parameters of the same name, or are used to form 
the values of additional HTTP headers X-Api-ClientId and X-Api-Signature. 
5. Programming interface methods (API) 
5.1. Refunds 
5.1.1. Create refund 
The refund creation method makes a refund for the particular payment 
HTTP request method 
 
POST 
 
URL 
 
https://api.7995-endpoint-b.com/api/v2/refunds 
 
HTTP request headers 
 
X-Api-ClientId contains ClientId. 
X-Api-RequestDate contains the date and time in ISO8601 when the request was generated. 
X-Api-Signature contains a checksum of the content of the HTTP request body according to the formula 
SHA-512(ClientId+X-Api-RequestDate+ClientSecret), that is, SHA-512 (HASH) is calculated from the concatenation 
of the ClientId value, the date and time value and the ClientSecret value of the system creating the payment. 
 
HTTP request body 
 
{  
        payment_id: string;               // Payment id of the payment to be refunded 
   amount: number;      // Refund amount 
   additional_data: string; // any additional data that will appear everywhere as a part of refund data, 
                                                                          // maximum length is 100 symbols 
 
} 
 
Return value 
 
{ 
   data: { 
 refund_id: string;        // refund identifier 
   } 
} 
 
Error result 
 
In case of an error, a response will be returned in accordance with the description in section “3. General 
information about the programming interface (API) ". 
 
 
5.1.2. Obtaining refund status 
The method for getting information about refunds returns a list of refund data blocks, starting with the latest. 
HTTP request method 
 
GET 
 
URL 
 
https://api.7995-endpoint-b.com/api/v2/refunds?offset=<number of items to skip>&limit=<number of items per 
response>&after_date=<date in ISO8601 format>&refund_ids=<id1>,<id2>… 
 
Query string parameters 
 
<id1>,<id2>… — comma-separated list of refund identifiers (refund_id) of the refunds to be returned in the list, 
maximum 20 refund identifiers can be passed. 
 
HTTP request headers 
 
X-Api-ClientId contains ClientId. 
X-Api-RequestDate contains the date and time in ISO8601 when the request was generated. 
X-Api-Signature contains a checksum of the content of the HTTP request body according to the formula 
SHA-512(ClientId+X-Api-RequestDate+ClientSecret), that is, SHA-512 (HASH) is calculated from the concatenation 
of the ClientId value, the date and time value and the ClientSecret value of the system creating the refund. 
 
HTTP request body 
 
Empty 
 
Return value 
 
{ 
   data: [{ 
      refund_id: string;    // Refund identifier 
                user_id: string;                // Unique identifier of the payment receiving platform member 
      payment_id: string;    // Payment identifier 
      payment_amount: number;          // Payment amount 
      amount: number;                 // Refund amount 
      payment_currency: string;     // Payment currency in ISO 4217 format (e.g., EUR) 
      currency: string;           // Refund currency in ISO 4217 format (e.g., EUR) 
      message: string;     // Sender’s message 
      date: string;                     // Refund date and time in ISO8601 format 
           additional_data: string; // Additional parameters passed when the payment was created 
                transaction_id: string;  // Refund internal transaction identifier 
                transaction_status_code: number; // Refund status:  
 //  -1 —DECLINED 
                 // 0 —NEW 
 // 1 —PROCESSING 
 // 2 —COMPLETED 
      transaction_status_text: string; // Refund status text 
      transaction_status_data: string; // Refund decline reason if refund was declined 
      payment_method_id: string;  // Payment method identifier 
      payment_method_name: string; // Payment method name 
      payment_method_data: string; // Payment method data 
      payer_ip: string;  // Payer IP-address 
      payer_country: string; // Payer country (by IP-address; in ISO 3166-1 alpha-2 format) 
      payer_email: string;  // Payer email. 
  }], 
  total: number;                                // Total number of items (starting from after_date, if passed) 
  response_date: string;           // Server date and time in ISO8601 format 
} 
 
Error result 
 
In case of an error, a response will be returned in accordance with the description in section “3. General 
information about the programming interface (API) ". 
 
 
6. Postback notifications (callbacks) 
6.1. General information 
Notifications are sent as HTTP(S) POST requests with Content-Type: application/json. 
Additional HTTP header X-Signature contains a checksum of the content of the HTTP request body according to the 
formula SHA-512(ClientId+body+ClientSecret), that is, SHA-512 (HASH) is calculated from the concatenation of the 
ClientId value, the notification request body and the ClientSecret value of the system creating the refund. 
The checksum must be verified by a checksum calculation on the recipient side and comparing it with the checksum 
passed in the header. Equality of specified values will confirm that the content of the request is unchanged during 
transmission. 
A notification is considered delivered if a response with an HTTP 200 OK status was received in response to the 
request. 
6.2. Refund status change notifications 
A notification about a change in the refund status is sent to the external system by sending an HTTP POST request to 
the RefundCallbackUrl URL. 
HTTP request body contains the following data. 
{ 
   data: { 
      refund_id: string;    // Refund identifier 
                user_id: string;                // Unique identifier of the payment receiving platform member 
      payment_id: string;    // Payment identifier 
      payment_amount: number;          // Payment amount 
      amount: number;                 // Refund amount 
      payment_currency: string;     // Payment currency in ISO 4217 format (e.g., EUR) 
      currency: string;           // Refund currency in ISO 4217 format (e.g., EUR) 
      message: string;     // Sender’s message 
      date: string;                     // Refund date and time in ISO8601 format 
           additional_data: string; // Additional parameters passed when the payment was created 
                transaction_id: string;  // Refund internal transaction identifier 
                transaction_status_code: number; // Refund status 
 //  -1 —DECLINED 
                 // 0 —NEW 
 // 1 —PROCESSING 
 // 2 —COMPLETED 
      transaction_status_text: string; // Refund status text 
      transaction_status_data: string; // Refund decline reason if the refund was decline 
      payment_method_id: string;  // Payment method identifier 
      payment_method_name: string; // Payment method name 
      payment_method_data: string; // Payment method data 
      payer_ip: string;  // Payer IP-address 
      payer_country: string; // Payer country (by IP-address; in ISO 3166-1 alpha-2 format) 
      payer_email: string;  // Payer email 
   } 
}