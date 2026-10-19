import ReportProgress from "../../../components/ReportProgress";
export const metadata = {
  title: "Municipality report | kosova.report",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Municipality({ params }) {
  return <ReportProgress publicId={params.public_id} municipality />;
}
