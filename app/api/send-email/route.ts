import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

export async function POST(request: Request) {
  try {
    const { to, subject, html, replyTo } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject,
      html,
      reply_to: replyTo || 'alfeicon.games@gmail.com',
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
