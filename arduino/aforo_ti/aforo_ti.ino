#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

// -------- PINES --------
#define TRIG 7
#define ECHO 6
#define BUZZER 13
#define LED_VERDE 3
#define LED_ROJO 2
#define SERVO_PIN 10

// -------- OBJETOS --------
Servo barrera;
LiquidCrystal_I2C lcd(0x27, 16, 2);

// -------- CONFIG --------
const int AFORO_MAXIMO = 5;
const int DISTANCIA_DETECCION = 20;
const int DISTANCIA_LIBERACION = 30;

// -------- VARIABLES --------
int totalDetectados = 0;
int aforoActual = 0;

bool personaDetectada = false;

// Anti-rebote
unsigned long lastDetection = 0;
const int cooldown = 1500;

// -------- FUNCIONES --------

long medirDistancia()
{
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long duracion = pulseIn(ECHO, HIGH, 30000);

  if (duracion == 0)
    return 999;

  return duracion * 0.034 / 2;
}

void mostrarLCD(const char *mensaje)
{
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Aforo:");
  lcd.print(aforoActual);
  lcd.print("/");
  lcd.print(AFORO_MAXIMO);

  lcd.setCursor(0, 1);
  lcd.print(mensaje);
}

void abrirBarrera()
{
  barrera.write(90);
  delay(800);
  barrera.write(0);
}

void enviarJSON()
{
  Serial.print("{\"totalDetected\":");
  Serial.print(totalDetectados);
  Serial.print(",\"currentInside\":");
  Serial.print(aforoActual);
  Serial.println("}");
}

void procesarComandos()
{
  if (Serial.available())
  {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "IN")
    {
      totalDetectados++;
      aforoActual++;
      actualizarEstado();
      mostrarLCD("INGRESO WEB");
      enviarJSON();
    }
    else if (cmd == "OUT")
    {
      aforoActual = max(0, aforoActual - 1);
      actualizarEstado();
      mostrarLCD("SALIDA WEB");
      enviarJSON();
    }
    else if (cmd == "RESET")
    {
      totalDetectados = 0;
      aforoActual = 0;
      actualizarEstado();
      mostrarLCD("REINICIADO");
      enviarJSON();
    }
  }
}

void actualizarEstado()
{
  if (aforoActual < AFORO_MAXIMO)
  {
    digitalWrite(LED_VERDE, HIGH);
    digitalWrite(LED_ROJO, LOW);
  }
  else
  {
    digitalWrite(LED_VERDE, LOW);
    digitalWrite(LED_ROJO, HIGH);
  }
}

// -------- SETUP --------

void setup()
{
  Serial.begin(9600);

  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);

  pinMode(BUZZER, OUTPUT);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_ROJO, OUTPUT);

  barrera.attach(SERVO_PIN);
  barrera.write(0);

  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0);
  lcd.print("Sistema Aforo");
  lcd.setCursor(0, 1);
  lcd.print("Iniciando...");
  delay(1200);

  mostrarLCD("Modo: ENTRADA");

  actualizarEstado();

  enviarJSON();
}

// -------- LOOP --------

void loop()
{
  procesarComandos();

  long distancia = medirDistancia();

  // -------- DETECCION --------
  if (distancia <= DISTANCIA_DETECCION &&
      !personaDetectada &&
      millis() - lastDetection > cooldown)
  {

    personaDetectada = true;
    lastDetection = millis();

    if (aforoActual < AFORO_MAXIMO)
    {
      totalDetectados++;
      aforoActual++;

      mostrarLCD("INGRESO OK");
      tone(BUZZER, 1200, 150);

      abrirBarrera();
    }
    else
    {
      mostrarLCD("AFORO LLENO");
      tone(BUZZER, 500, 400);
    }

    actualizarEstado();
  }

  // -------- LIBERACION --------
  if (distancia >= DISTANCIA_LIBERACION)
  {
    personaDetectada = false;

    if (aforoActual < AFORO_MAXIMO)
    {
      mostrarLCD("Modo: ENTRADA");
    }
    else
    {
      mostrarLCD("AFORO LLENO");
    }
  }

  // -------- ENVIO A WEB --------
  enviarJSON();

  delay(200);
}