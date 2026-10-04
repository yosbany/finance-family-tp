import { Agent, Cursor } from "@cursor/sdk";

try {
  console.log("Attempting to list models...");
  const models = await Cursor.models.list();
  console.log("Available models:", models);
} catch (error) {
  console.error("Error listing models:", error.message);
  console.log("\nAttempting to login with Cursor.auth.login()...");
  try {
    await Cursor.auth.login();
    console.log("Login successful!");
    const models = await Cursor.models.list();
    console.log("Available models after login:", models);
  } catch (loginError) {
    console.error("Login failed:", loginError.message);
  }
}
