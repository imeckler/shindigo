import * as schedule from 'node-schedule';
import moment, {Moment} from 'moment-timezone';
import Event, { IEvent, IAttendee } from '../models/Event.js';
import twilioService from './twilio.js';
import { getConfig } from './config.js';

const config = getConfig();

enum ReminderType {
  DayBefore = 'day_before',
  TwoHoursBefore = 'two_hours_before'
}

interface ScheduledJob {
    eventId: string;
    type: ReminderType;
    jobId: string;
}

class EventReminderService {
    private scheduledJobs: Map<string, schedule.Job> = new Map();
    private isEnabled: boolean = false;

    constructor() {
        this.isEnabled = !!config.twilio && twilioService.isVerificationRequired();
    }

    private jobKey(eventId: string, type: ReminderType): string {
        return `${eventId}_${type}`;
    }

    private jobTime(event: IEvent, type: ReminderType): Moment {
      const start = moment(event.start).tz(event.timezone);
      switch (type) {
        case ReminderType.TwoHoursBefore:
          return start.subtract(2, 'hours');
        case ReminderType.DayBefore:
          return start.subtract(1, 'day').hour(10).minute(0).second(0);
      }
    }

    /**
     * Schedule reminder texts for an event
     * @param event The event to schedule reminders for
     */
    async scheduleReminders(event: IEvent): Promise<void> {
        if (!this.isEnabled) {
            console.log('Event reminders disabled - Twilio not configured');
            return;
        }

        if (!event.usersCanAttend || !event.attendees || event.attendees.length === 0) {
            console.log('No attendees to remind for event:', event.id);
            return;
        }

        // Clear any existing jobs for this event
        this.clearEventJobs(event.id);

        const now = moment();

        // Schedule day before reminder
        [ReminderType.DayBefore, ReminderType.TwoHoursBefore].forEach((ty) => {
          const time = this.jobTime(event, ty);
          if (time.isAfter(now)) {
            const job = schedule.scheduleJob(time.toDate(), () => {
                this.sendReminder(event.id, ty);
            });
            
            if (job) {
                this.scheduledJobs.set(this.jobKey(event.id, ty), job);
                console.log(`Scheduled ${ty} reminder for event ${event.id} at ${time.format()}`);
            }
          }
        });
    }

    /**
     * Clear all scheduled jobs for an event
     * @param eventId The event ID to clear jobs for
     */
    clearEventJobs(eventId: string): void {
        [ReminderType.DayBefore, ReminderType.TwoHoursBefore].forEach((ty) => {
          const key = this.jobKey(eventId, ty);
          const job = this.scheduledJobs.get(key);
          if (job) {
            job.cancel();
            this.scheduledJobs.delete(key);
          }
        });
    }

    /**
     * Send reminder to all attendees
     * @param eventId The event ID to send reminders for
     * @param reminderType The type of reminder to send
     */
    private async sendReminder(eventId: string, reminderType: 'day_before' | 'two_hours_before'): Promise<void> {
        try {
            const event = await Event.findOne({ id: eventId });
            if (!event) {
                console.error(`Event not found for ${reminderType} reminder:`, eventId);
                return;
            }

            // TODO: check status
            const attendees = event.attendees?.filter(attendee => 
                attendee.phoneNumber
            ) || [];

            console.log(`Sending ${reminderType} reminders to ${attendees.length} attendees for event: ${event.name}`);

            const message = this.generateReminderMessage(event, reminderType);

            for (const attendee of attendees) {
                await this.sendReminderText(attendee.phoneNumber!, message);
            }
        } catch (error) {
            console.error(`Error sending ${reminderType} reminder for event`, eventId, error);
        }
    }

    /**
     * Generate the appropriate reminder message based on type
     * @param event The event object
     * @param reminderType The type of reminder
     */
    private generateReminderMessage(event: IEvent, reminderType: 'day_before' | 'two_hours_before'): string {
        const eventTime = moment(event.start).tz(event.timezone);

        if (reminderType === 'day_before') {
            const formattedTime = eventTime.format('MMMM Do, YYYY [at] h:mm A z');
            return `Reminder: You're attending "${event.name}" tomorrow (${formattedTime}) at ${event.location}. Looking forward to seeing you there!`;
        } else {
            const formattedTime = eventTime.format('h:mm A z');
            return `Final reminder: "${event.name}" starts at ${formattedTime} at ${event.location}. See you soon!`;
        }
    }

    /**
     * Send a reminder text message
     * @param phoneNumber The phone number to send to
     * @param message The message content
     */
    private async sendReminderText(phoneNumber: string, message: string): Promise<void> {
        try {
            // Use the existing Twilio client from twilioService
            const twilioClient = (twilioService as any).client;
            const messagingServiceSid = (twilioService as any).messagingServiceSid;
            const fromPhoneNumber = (twilioService as any).fromPhoneNumber;

            if (!twilioClient) {
                console.error('Twilio client not available for reminder');
                return;
            }

            if (messagingServiceSid) {
                await twilioClient.messages.create({
                    body: message,
                    to: phoneNumber,
                    messagingServiceSid: messagingServiceSid
                });
            } else {
                await twilioClient.messages.create({
                    body: message,
                    to: phoneNumber,
                    from: fromPhoneNumber
                });
            }

            console.log(`Reminder sent to ${phoneNumber}`);
        } catch (error) {
            console.error('Error sending reminder text:', error);
        }
    }

    /**
     * Reschedule reminders for all upcoming events
     * Called on application startup to restore scheduled jobs
     */
    async rescheduleAllUpcomingEvents(): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        try {
            const now = new Date();
            const upcomingEvents = await Event.find({
                start: { $gt: now },
                usersCanAttend: true,
                attendees: { $exists: true, $not: { $size: 0 } }
            });

            console.log(`Rescheduling reminders for ${upcomingEvents.length} upcoming events`);

            for (const event of upcomingEvents) {
                await this.scheduleReminders(event);
            }
        } catch (error) {
            console.error('Error rescheduling upcoming events:', error);
        }
    }

    /**
     * Get information about currently scheduled jobs
     */
    getScheduledJobsInfo(): Array<{ eventId: string; type: string; scheduledTime: Date }> {
        const jobsInfo: Array<{ eventId: string; type: string; scheduledTime: Date }> = [];
        
        this.scheduledJobs.forEach((job, key) => {
            const [eventId, type] = key.split('_');
            jobsInfo.push({
                eventId,
                type: type === 'day' ? 'day_before' : 'two_hours_before',
                scheduledTime: job.nextInvocation()
            });
        });

        return jobsInfo;
    }
}

export default new EventReminderService();
