import mongoose from "mongoose";
import { getConfig } from "./lib/config.js";
import app from "./app.js";
import eventReminderService from "./lib/eventReminders.js";

const config = getConfig();

mongoose.connect(config.database.mongodb_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
mongoose.set("useCreateIndex", true);
mongoose.set("useFindAndModify", false);
mongoose.Promise = global.Promise;
mongoose.connection
    .on("connected", async () => {
        console.log("Mongoose connection open!");
        
        // Reschedule reminders for existing upcoming events
        await eventReminderService.rescheduleAllUpcomingEvents();
    })
    .on("error", (err: any) => {
        console.log(`Connection error: ${err.message}`);
    });

const server = app.listen(config.general.port, () => {
    console.log(
        `Welcome to gathio! The app is now running on http://localhost:${config.general.port}`,
    );
});
