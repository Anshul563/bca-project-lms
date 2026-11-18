import type { Metadata } from "next";

import { CertificateView } from "@/features/certificates/certificate-view";

interface CertificatePageProps {
  params: Promise<{ serial: string }>;
}

// The serial segment is read at request time (cacheComponents opt-out);
// the certificate itself is fetched client-side and verified publicly.
export const instant = false;

export const metadata: Metadata = {
  title: "Certificate",
};

export default async function CertificatePage({ params }: CertificatePageProps) {
  const { serial } = await params;
  return <CertificateView serial={serial} />;
}
