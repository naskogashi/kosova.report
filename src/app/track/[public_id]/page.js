import ReportProgress from "../../../components/ReportProgress";
export const metadata = {
  title: "Report progress | kosova.report",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Track(props) {
  const params = await props.params;
  return <ReportProgress publicId={params.public_id} />;
}
