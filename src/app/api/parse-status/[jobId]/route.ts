import { NextRequest, NextResponse } from "next/server";
import { getParseJobStatus } from "@/lib/opendota";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId: jobIdParam } = await params;
  const jobId = Number(jobIdParam);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  try {
    // OpenDota returns the job payload while queued/running and an empty
    // body once it's done and has been removed from the queue.
    const status = await getParseJobStatus(jobId);
    return NextResponse.json({ done: status === null, status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check parse status" },
      { status: 502 }
    );
  }
}
