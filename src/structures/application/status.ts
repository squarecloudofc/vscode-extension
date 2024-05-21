import type { If } from "@/types/helpers";
import type {
	ApplicationStatus as BaseApplicationStatus,
	SimpleApplicationStatus as BaseSimpleApplicationStatus,
} from "@squarecloud/api";
import type { ApplicationStatusUsage } from "@squarecloud/api/lib/types/application";

export class ApplicationStatus<Full extends boolean = boolean> {
	public applicationId: string;
	public usage: If<
		Full,
		ApplicationStatusUsage,
		Pick<ApplicationStatusUsage, "cpu" | "ram">
	>;
	public running: boolean;
	public status?: If<Full, string>;
	public requests?: If<Full, number>;
	public uptimeTimestamp?: number;
	public uptime?: Date;

	/**
	 * Constructs a new instance of the class.
	 *
	 * @param baseStatus - The base status object.
	 */
	constructor(
		private readonly baseStatus: If<
			Full,
			BaseApplicationStatus,
			BaseSimpleApplicationStatus
		>,
	) {
		this.applicationId = baseStatus.applicationId;
		this.running = baseStatus.running;
		this.usage = baseStatus.usage as ApplicationStatusUsage;

		if ("requests" in baseStatus) {
			this.status = baseStatus.status;
			this.requests = baseStatus.requests;
			this.uptimeTimestamp = baseStatus.uptimeTimestamp;
			this.uptime = baseStatus.uptime;
		}
	}

	isFull(): this is ApplicationStatus<true> {
		return "requests" in this.baseStatus;
	}
}
