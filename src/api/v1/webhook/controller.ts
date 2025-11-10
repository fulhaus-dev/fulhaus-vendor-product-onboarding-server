import type { Request, Response } from "express";

export async function vendorProductWebhookReceiver(req: Request, res: Response) {
	//   const { email } = sendOtpValidationSchema.parse(req.body);

	//   const { data: otp, errorRecord: generateOtpErrorRecord } =
	//     await generateOtpService(email);
	//   if (generateOtpErrorRecord)
	//     throw ServerError.ErrorRecord(generateOtpErrorRecord);

	//   const { errorRecord: sendAuthOtpErrorRecord } = await sendAuthOtpEmailService(
	//     email,
	//     otp
	//   );
	//   if (sendAuthOtpErrorRecord)
	//     throw ServerError.ErrorRecord(sendAuthOtpErrorRecord);

	res.json({ message: "Webhook Received!" });
}
