#include <Servo.h>

const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
const int SERVO_PIN = 6;
const int LED_GREEN = 4;
const int LED_RED = 5;
const int BUZZER_PIN = 3;
const int EXIT_BUTTON_PIN = 7;

const int MAX_CAPACITY = 30;
const int DETECT_DISTANCE_CM = 18;
const unsigned long DETECT_COOLDOWN_MS = 1400;

Servo barrier;

int totalDetected = 0;
int currentInside = 0;
bool objectWasNear = false;
unsigned long lastDetectionMs = 0;

void setup() {
  Serial.begin(9600);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(EXIT_BUTTON_PIN, INPUT_PULLUP);

  barrier.attach(SERVO_PIN);
  updateOutputs();
  sendState("READY");
}

void loop() {
  handleSerialCommands();
  handleUltrasonicEntry();
  handleExitButton();
}

void handleUltrasonicEntry() {
  long distance = readDistanceCm();
  bool objectIsNear = distance > 0 && distance <= DETECT_DISTANCE_CM;
  unsigned long now = millis();

  if (objectIsNear && !objectWasNear && now - lastDetectionMs > DETECT_COOLDOWN_MS) {
    lastDetectionMs = now;
    totalDetected += 1;

    if (currentInside < MAX_CAPACITY) {
      currentInside += 1;
      sendState("IN");
    } else {
      tone(BUZZER_PIN, 1200, 350);
      sendState("BLOCKED");
    }

    updateOutputs();
  }

  objectWasNear = objectIsNear;
}

void handleExitButton() {
  static bool lastButtonState = HIGH;
  bool buttonState = digitalRead(EXIT_BUTTON_PIN);

  if (lastButtonState == HIGH && buttonState == LOW) {
    currentInside = max(0, currentInside - 1);
    updateOutputs();
    sendState("OUT");
    delay(220);
  }

  lastButtonState = buttonState;
}

void handleSerialCommands() {
  if (!Serial.available()) {
    return;
  }

  String command = Serial.readStringUntil('\n');
  command.trim();

  if (command == "RESET") {
    totalDetected = 0;
    currentInside = 0;
    updateOutputs();
    sendState("RESET");
  } else if (command == "OUT") {
    currentInside = max(0, currentInside - 1);
    updateOutputs();
    sendState("OUT");
  } else if (command == "IN") {
    totalDetected += 1;
    currentInside += 1;
    updateOutputs();
    sendState("IN");
  }
}

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    return -1;
  }

  return duration * 0.034 / 2;
}

void updateOutputs() {
  bool allowed = currentInside < MAX_CAPACITY;

  digitalWrite(LED_GREEN, allowed ? HIGH : LOW);
  digitalWrite(LED_RED, allowed ? LOW : HIGH);
  barrier.write(allowed ? 90 : 0);

  if (!allowed) {
    tone(BUZZER_PIN, 900, 120);
  }
}

void sendState(const char *eventName) {
  Serial.print("{\"event\":\"");
  Serial.print(eventName);
  Serial.print("\",\"totalDetected\":");
  Serial.print(totalDetected);
  Serial.print(",\"currentInside\":");
  Serial.print(currentInside);
  Serial.print(",\"maxCapacity\":");
  Serial.print(MAX_CAPACITY);
  Serial.print(",\"access\":\"");
  Serial.print(currentInside >= MAX_CAPACITY ? "blocked" : "allowed");
  Serial.println("\"}");
}
