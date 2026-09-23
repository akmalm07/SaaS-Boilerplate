import type { GeneratorConfig, TemplateContribution } from '../core/types.js';

const MODULE = '${MODULE}';
const moduleName = MODULE;
const render = (source: string, config: GeneratorConfig) =>
  source.replaceAll(moduleName, `${config.projectName}/backend`);

const main = `package main
import (
 "context"; "log"; "log/slog"; "net/http"
 "cloud.google.com/go/firestore"; cloudstorage "cloud.google.com/go/storage"
 "${MODULE}/internal/auth"; "${MODULE}/internal/config"; "${MODULE}/internal/database/firestoredb"; "${MODULE}/internal/httpapi"; "${MODULE}/internal/storage/gcs"
)
func main() {
 cfg,err:=config.Load(); if err!=nil { log.Fatal(err) }; ctx:=context.Background()
 db,err:=firestore.NewClient(ctx,cfg.FirebaseProjectID); if err!=nil { log.Fatal("connect Firestore: ",err) }; defer db.Close()
 cloud,err:=cloudstorage.NewClient(ctx); if err!=nil { log.Fatal("connect GCS: ",err) }; defer cloud.Close()
 api:=httpapi.NewServer(firestoredb.NewUserRepository(db),gcs.NewStorage(cloud,cfg.GCPStorageBucket),auth.NewSessionManager(cfg.SessionSecret,cfg.JWTIssuer,cfg.JWTAudience))
 slog.Info("API listening","address",cfg.ListenAddress); log.Fatal(http.ListenAndServe(cfg.ListenAddress,httpapi.CORS(cfg.FrontendURL,api.Routes())))
}
`;

const configFile = `package config
import ("fmt"; "os")
type Config struct { ListenAddress, FrontendURL, FirebaseProjectID, GCPStorageBucket, SessionSecret, JWTIssuer, JWTAudience string }
func Load() (Config,error) { c:=Config{ListenAddress:":"+value("PORT","3000"),FrontendURL:value("FRONTEND_URL","http://localhost:5173"),FirebaseProjectID:os.Getenv("FIREBASE_PROJECT_ID"),GCPStorageBucket:os.Getenv("GCP_STORAGE_BUCKET"),SessionSecret:os.Getenv("SESSION_SECRET"),JWTIssuer:os.Getenv("JWT_ISSUER"),JWTAudience:os.Getenv("JWT_AUDIENCE")}; for k,v:=range map[string]string{"FIREBASE_PROJECT_ID":c.FirebaseProjectID,"GCP_STORAGE_BUCKET":c.GCPStorageBucket,"SESSION_SECRET":c.SessionSecret,"JWT_ISSUER":c.JWTIssuer,"JWT_AUDIENCE":c.JWTAudience} { if v=="" { return Config{},fmt.Errorf("missing required environment variable: %s",k) } }; return c,nil }
func value(k,fallback string) string { if v:=os.Getenv(k);v!="" { return v };return fallback }
`;

const domain = `package domain
type User struct { ID string \`firestore:"id" json:"id"\`; Email string \`firestore:"email" json:"email"\`; Name string \`firestore:"name" json:"name"\`; PasswordHash string \`firestore:"passwordHash" json:"-"\` }
type Registration struct { Email string \`json:"email"\`; Password string \`json:"password"\`; Name string \`json:"name"\` }
type Login struct { Email string \`json:"email"\`; Password string \`json:"password"\` }
`;

const repository = `package firestoredb
import ("context"; "errors"; "cloud.google.com/go/firestore"; "${MODULE}/internal/domain"; "google.golang.org/grpc/codes"; "google.golang.org/grpc/status")
var ErrNotFound=errors.New("user not found")
type UserRepository struct { collection *firestore.CollectionRef }
func NewUserRepository(client *firestore.Client)*UserRepository{return &UserRepository{collection:client.Collection("users")}}
func(r *UserRepository)Create(ctx context.Context,user domain.User)error{_,err:=r.collection.Doc(user.ID).Create(ctx,user);return err}
func(r *UserRepository)FindByID(ctx context.Context,id string)(domain.User,error){doc,err:=r.collection.Doc(id).Get(ctx);if err!=nil{if status.Code(err)==codes.NotFound{return domain.User{},ErrNotFound};return domain.User{},err};var user domain.User;if err=doc.DataTo(&user);err!=nil{return domain.User{},err};return user,nil}
func(r *UserRepository)FindByEmail(ctx context.Context,email string)(domain.User,error){docs,err:=r.collection.Where("email","==",email).Limit(1).Documents(ctx).GetAll();if err!=nil{return domain.User{},err};if len(docs)==0{return domain.User{},ErrNotFound};var user domain.User;if err=docs[0].DataTo(&user);err!=nil{return domain.User{},err};return user,nil}
`;

const storage = `package gcs
import cloudstorage "cloud.google.com/go/storage"
// Storage is the boundary between file routes and the selected cloud SDK.
type Storage struct { Bucket *cloudstorage.BucketHandle }
func NewStorage(client *cloudstorage.Client,bucket string)*Storage{return &Storage{Bucket:client.Bucket(bucket)}}
`;

const session = `package auth
import("net/http";"os";"time";"github.com/golang-jwt/jwt/v5")
type SessionManager struct{secret []byte;issuer,audience string}
func NewSessionManager(secret,issuer,audience string)*SessionManager{return &SessionManager{secret:[]byte(secret),issuer:issuer,audience:audience}}
func(s *SessionManager)Set(w http.ResponseWriter,userID string)error{token,err:=jwt.NewWithClaims(jwt.SigningMethodHS256,jwt.MapClaims{"sub":userID,"iss":s.issuer,"aud":s.audience,"exp":time.Now().Add(24*time.Hour).Unix()}).SignedString(s.secret);if err!=nil{return err};http.SetCookie(w,&http.Cookie{Name:"session",Value:token,Path:"/",HttpOnly:true,SameSite:http.SameSiteLaxMode,Secure:os.Getenv("NODE_ENV")=="production",MaxAge:86400});return nil}
func(s *SessionManager)UserID(r *http.Request)(string,bool){cookie,err:=r.Cookie("session");if err!=nil{return "",false};claims:=jwt.MapClaims{};token,err:=jwt.ParseWithClaims(cookie.Value,claims,func(t *jwt.Token)(any,error){return s.secret,nil},jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),jwt.WithIssuer(s.issuer),jwt.WithAudience(s.audience));if err!=nil||!token.Valid{return "",false};id,ok:=claims["sub"].(string);return id,ok}
func(s *SessionManager)Clear(w http.ResponseWriter){http.SetCookie(w,&http.Cookie{Name:"session",Value:"",Path:"/",HttpOnly:true,MaxAge:-1})}
`;

const server = `package httpapi
import("net/http";"${MODULE}/internal/auth";"${MODULE}/internal/database/firestoredb";"${MODULE}/internal/storage/gcs")
type Server struct{users *firestoredb.UserRepository;files *gcs.Storage;sessions *auth.SessionManager}
func NewServer(users *firestoredb.UserRepository,files *gcs.Storage,sessions *auth.SessionManager)*Server{return &Server{users:users,files:files,sessions:sessions}}
func(s *Server)Routes()http.Handler{mux:=http.NewServeMux();mux.HandleFunc("GET /api/v1/health",s.health);mux.HandleFunc("POST /api/v1/auth/register",s.register);mux.HandleFunc("POST /api/v1/auth/login",s.login);mux.HandleFunc("POST /api/v1/auth/logout",s.logout);mux.HandleFunc("GET /api/v1/users/me",s.me);return mux}
func(s *Server)health(w http.ResponseWriter,_ *http.Request){respond(w,200,map[string]string{"status":"ok"})}
`;

const response = `package httpapi
import("encoding/json";"net/http")
func respond(w http.ResponseWriter,status int,value any){w.Header().Set("Content-Type","application/json");w.WriteHeader(status);_ = json.NewEncoder(w).Encode(value)}
func errorResponse(w http.ResponseWriter,status int,message string){respond(w,status,map[string]string{"error":message})}
func decodeJSON(w http.ResponseWriter,r *http.Request,target any)bool{r.Body=http.MaxBytesReader(w,r.Body,1<<20);if json.NewDecoder(r.Body).Decode(target)!=nil{errorResponse(w,400,"invalid JSON request body");return false};return true}
`;

const authRoutes = `package httpapi
import("crypto/rand";"encoding/base64";"errors";"net/http";"strings";"${MODULE}/internal/database/firestoredb";"${MODULE}/internal/domain";"golang.org/x/crypto/bcrypt")
func(s *Server)register(w http.ResponseWriter,r *http.Request){var input domain.Registration;if !decodeJSON(w,r,&input){return};input.Email=strings.ToLower(strings.TrimSpace(input.Email));if !strings.Contains(input.Email,"@")||len(input.Password)<12{errorResponse(w,400,"a valid email and 12-character password are required");return};if _,err:=s.users.FindByEmail(r.Context(),input.Email);err==nil{errorResponse(w,409,"email already registered");return}else if !errors.Is(err,firestoredb.ErrNotFound){errorResponse(w,500,"database error");return};raw:=make([]byte,18);if _,err:=rand.Read(raw);err!=nil{errorResponse(w,500,"could not create account");return};hash,err:=bcrypt.GenerateFromPassword([]byte(input.Password),bcrypt.DefaultCost);if err!=nil{errorResponse(w,500,"could not secure password");return};user:=domain.User{ID:base64.RawURLEncoding.EncodeToString(raw),Email:input.Email,Name:input.Name,PasswordHash:string(hash)};if err=s.users.Create(r.Context(),user);err!=nil{errorResponse(w,500,"database error");return};if err=s.sessions.Set(w,user.ID);err!=nil{errorResponse(w,500,"could not create session");return};respond(w,201,map[string]domain.User{"user":user})}
func(s *Server)login(w http.ResponseWriter,r *http.Request){var input domain.Login;if !decodeJSON(w,r,&input){return};user,err:=s.users.FindByEmail(r.Context(),strings.ToLower(strings.TrimSpace(input.Email)));if err!=nil||bcrypt.CompareHashAndPassword([]byte(user.PasswordHash),[]byte(input.Password))!=nil{errorResponse(w,401,"invalid credentials");return};if err=s.sessions.Set(w,user.ID);err!=nil{errorResponse(w,500,"could not create session");return};respond(w,200,map[string]domain.User{"user":user})}
func(s *Server)logout(w http.ResponseWriter,_ *http.Request){s.sessions.Clear(w);w.WriteHeader(http.StatusNoContent)}
`;

const userRoutes = `package httpapi
import"net/http"
func(s *Server)me(w http.ResponseWriter,r *http.Request){id,ok:=s.sessions.UserID(r);if !ok{errorResponse(w,401,"authentication required");return};user,err:=s.users.FindByID(r.Context(),id);if err!=nil{errorResponse(w,404,"user not found");return};respond(w,200,user)}
`;

const cors = `package httpapi
import"net/http"
func CORS(origin string,next http.Handler)http.Handler{return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.Header().Set("Access-Control-Allow-Origin",origin);w.Header().Set("Access-Control-Allow-Credentials","true");w.Header().Set("Access-Control-Allow-Headers","Content-Type");w.Header().Set("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE, OPTIONS");if r.Method==http.MethodOptions{w.WriteHeader(http.StatusNoContent);return};next.ServeHTTP(w,r)})}
`;

const postgresMain = `package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"${MODULE}/internal/auth"
	"${MODULE}/internal/config"
	"${MODULE}/internal/database/postgresdb"
	"${MODULE}/internal/httpapi"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal("connect PostgreSQL: ", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatal("ping PostgreSQL: ", err)
	}

	api := httpapi.NewServer(
		postgresdb.NewUserRepository(pool),
		auth.NewSessionManager(cfg.SessionSecret, cfg.JWTIssuer, cfg.JWTAudience),
	)

	slog.Info("API listening", "address", cfg.ListenAddress)
	log.Fatal(http.ListenAndServe(cfg.ListenAddress, httpapi.CORS(cfg.FrontendURL, api.Routes())))
}
`;

const postgresConfig = `package config

import (
	"fmt"
	"os"
)

type Config struct {
	ListenAddress string
	FrontendURL   string
	DatabaseURL   string
	SessionSecret string
	JWTIssuer     string
	JWTAudience   string
}

func Load() (Config, error) {
	config := Config{
		ListenAddress: value("PORT", ":3000"),
		FrontendURL:   value("FRONTEND_URL", "http://localhost:5173"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		SessionSecret: os.Getenv("SESSION_SECRET"),
		JWTIssuer:     os.Getenv("JWT_ISSUER"),
		JWTAudience:   os.Getenv("JWT_AUDIENCE"),
	}

	for key, value := range map[string]string{
		"DATABASE_URL":   config.DatabaseURL,
		"SESSION_SECRET": config.SessionSecret,
		"JWT_ISSUER":     config.JWTIssuer,
		"JWT_AUDIENCE":   config.JWTAudience,
	} {
		if value == "" {
			return Config{}, fmt.Errorf("missing required environment variable: %s", key)
		}
	}

	return config, nil
}

func value(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
`;

const postgresDomain =
  `package domain

type User struct {
	ID           string ` +
  '`json:"id"`' +
  `
	Email        string ` +
  '`json:"email"`' +
  `
	Name         string ` +
  '`json:"name"`' +
  `
	PasswordHash string ` +
  '`json:"-"`' +
  `
}

type Registration struct {
	Email    string ` +
  '`json:"email"`' +
  `
	Password string ` +
  '`json:"password"`' +
  `
	Name     string ` +
  '`json:"name"`' +
  `
}

type Login struct {
	Email    string ` +
  '`json:"email"`' +
  `
	Password string ` +
  '`json:"password"`' +
  `
}
`;

const postgresRepository = `package postgresdb

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"${MODULE}/internal/domain"
)

var ErrNotFound = errors.New("user not found")

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (repository *UserRepository) Create(ctx context.Context, user domain.User) error {
	_, err := repository.pool.Exec(
		ctx,
		"INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)",
		user.ID,
		user.Email,
		user.Name,
		user.PasswordHash,
	)
	return err
}

func (repository *UserRepository) FindByID(ctx context.Context, id string) (domain.User, error) {
	return repository.find(ctx, "SELECT id, email, name, password_hash FROM users WHERE id = $1", id)
}

func (repository *UserRepository) FindByEmail(ctx context.Context, email string) (domain.User, error) {
	return repository.find(ctx, "SELECT id, email, name, password_hash FROM users WHERE email = $1", email)
}

func (repository *UserRepository) find(ctx context.Context, query, value string) (domain.User, error) {
	var user domain.User
	err := repository.pool.QueryRow(ctx, query, value).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, ErrNotFound
	}
	return user, err
}
`;

const postgresServer = `package httpapi

import (
	"net/http"

	"${MODULE}/internal/auth"
	"${MODULE}/internal/database/postgresdb"
)

type Server struct {
	users    *postgresdb.UserRepository
	sessions *auth.SessionManager
}

func NewServer(users *postgresdb.UserRepository, sessions *auth.SessionManager) *Server {
	return &Server{users: users, sessions: sessions}
}

func (server *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", server.health)
	mux.HandleFunc("POST /api/v1/auth/register", server.register)
	mux.HandleFunc("POST /api/v1/auth/login", server.login)
	mux.HandleFunc("POST /api/v1/auth/logout", server.logout)
	mux.HandleFunc("GET /api/v1/users/me", server.me)
	return mux
}

func (server *Server) health(writer http.ResponseWriter, _ *http.Request) {
	respond(writer, http.StatusOK, map[string]string{"status": "ok"})
}
`;

const postgresAuthRoutes = `package httpapi

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"${MODULE}/internal/database/postgresdb"
	"${MODULE}/internal/domain"
)

func (server *Server) register(writer http.ResponseWriter, request *http.Request) {
	var input domain.Registration
	if !decodeJSON(writer, request, &input) {
		return
	}

	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if !strings.Contains(input.Email, "@") || len(input.Password) < 12 {
		errorResponse(writer, http.StatusBadRequest, "a valid email and 12-character password are required")
		return
	}

	if _, err := server.users.FindByEmail(request.Context(), input.Email); err == nil {
		errorResponse(writer, http.StatusConflict, "email already registered")
		return
	} else if !errors.Is(err, postgresdb.ErrNotFound) {
		errorResponse(writer, http.StatusInternalServerError, "database error")
		return
	}

	rawID := make([]byte, 18)
	if _, err := rand.Read(rawID); err != nil {
		errorResponse(writer, http.StatusInternalServerError, "could not create account")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		errorResponse(writer, http.StatusInternalServerError, "could not secure password")
		return
	}

	user := domain.User{
		ID:           base64.RawURLEncoding.EncodeToString(rawID),
		Email:        input.Email,
		Name:         input.Name,
		PasswordHash: string(hash),
	}
	if err := server.users.Create(request.Context(), user); err != nil {
		errorResponse(writer, http.StatusInternalServerError, "database error")
		return
	}
	if err := server.sessions.Set(writer, user.ID); err != nil {
		errorResponse(writer, http.StatusInternalServerError, "could not create session")
		return
	}
	respond(writer, http.StatusCreated, map[string]domain.User{"user": user})
}

func (server *Server) login(writer http.ResponseWriter, request *http.Request) {
	var input domain.Login
	if !decodeJSON(writer, request, &input) {
		return
	}

	user, err := server.users.FindByEmail(request.Context(), strings.ToLower(strings.TrimSpace(input.Email)))
	if err != nil || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)) != nil {
		errorResponse(writer, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err := server.sessions.Set(writer, user.ID); err != nil {
		errorResponse(writer, http.StatusInternalServerError, "could not create session")
		return
	}
	respond(writer, http.StatusOK, map[string]domain.User{"user": user})
}

func (server *Server) logout(writer http.ResponseWriter, _ *http.Request) {
	server.sessions.Clear(writer)
	writer.WriteHeader(http.StatusNoContent)
}
`;

const postgresUserRoutes = `package httpapi

import "net/http"

func (server *Server) me(writer http.ResponseWriter, request *http.Request) {
	id, ok := server.sessions.UserID(request)
	if !ok {
		errorResponse(writer, http.StatusUnauthorized, "authentication required")
		return
	}

	user, err := server.users.FindByID(request.Context(), id)
	if err != nil {
		errorResponse(writer, http.StatusNotFound, "user not found")
		return
	}
	respond(writer, http.StatusOK, user)
}
`;

function goPostgresBackend(config: GeneratorConfig): TemplateContribution {
  const file = (value: string) => render(value, config);
  return {
    files: {
      'backend/go.mod': `module ${config.projectName}/backend

go 1.24

require (
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/jackc/pgx/v5 v5.7.6
	golang.org/x/crypto v0.31.0
)
`,
      'backend/cmd/api/main.go': file(postgresMain),
      'backend/internal/config/config.go': postgresConfig,
      'backend/internal/domain/user.go': postgresDomain,
      'backend/internal/database/postgresdb/user_repository.go': file(postgresRepository),
      'backend/internal/auth/session.go': session,
      'backend/internal/httpapi/server.go': file(postgresServer),
      'backend/internal/httpapi/response.go': response,
      'backend/internal/httpapi/auth_routes.go': file(postgresAuthRoutes),
      'backend/internal/httpapi/user_routes.go': postgresUserRoutes,
      'backend/internal/httpapi/cors.go': cors,
      'backend/migrations/001_initial.sql':
        "CREATE TABLE IF NOT EXISTS users (\n  id TEXT PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE,\n  name TEXT NOT NULL DEFAULT '',\n  password_hash TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);\n",
      'backend/Dockerfile':
        'FROM golang:1.24-alpine AS build\nWORKDIR /src\nCOPY go.mod ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /api ./cmd/api\nFROM gcr.io/distroless/static-debian12\nCOPY --from=build /api /api\nENV PORT=8080\nUSER nonroot:nonroot\nENTRYPOINT ["/api"]\n',
      'backend/README.md':
        '# Go PostgreSQL API\n\nRun `go mod tidy`, apply `migrations/001_initial.sql` using the direct Neon connection, then run `go run ./cmd/api`. The API uses the pooled `DATABASE_URL` for request traffic.\n',
    },
    readmeSections: [
      '## Go with PostgreSQL or Neon\n\nThe Go API uses `pgxpool` with the selected `DATABASE_URL`. For Neon, use the pooled connection URL at runtime and `DATABASE_URL_UNPOOLED` only for migrations.',
    ],
  };
}

export function goBackend(config: GeneratorConfig): TemplateContribution {
  if (config.database === 'postgres' || config.database === 'neon') {
    return goPostgresBackend(config);
  }

  const file = (value: string) => render(value, config);
  return {
    files: {
      'backend/go.mod': `module ${config.projectName}/backend\n\ngo 1.22\n\nrequire (\n cloud.google.com/go/firestore v1.16.0\n cloud.google.com/go/storage v1.43.0\n github.com/golang-jwt/jwt/v5 v5.2.1\n golang.org/x/crypto v0.31.0\n)\n`,
      'backend/cmd/api/main.go': file(main),
      'backend/internal/config/config.go': configFile,
      'backend/internal/domain/user.go': domain,
      'backend/internal/database/firestoredb/user_repository.go': file(repository),
      'backend/internal/storage/gcs/storage.go': storage,
      'backend/internal/auth/session.go': session,
      'backend/internal/httpapi/server.go': file(server),
      'backend/internal/httpapi/response.go': response,
      'backend/internal/httpapi/auth_routes.go': file(authRoutes),
      'backend/internal/httpapi/user_routes.go': userRoutes,
      'backend/internal/httpapi/cors.go': cors,
      'backend/Dockerfile':
        'FROM golang:1.22-alpine AS build\nWORKDIR /src\nCOPY go.mod ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /api ./cmd/api\nFROM gcr.io/distroless/static-debian12\nCOPY --from=build /api /api\nENV PORT=8080\nUSER nonroot:nonroot\nENTRYPOINT ["/api"]\n',
      'scripts/deploy-cloud-run.ps1':
        'param([Parameter(Mandatory=$true)][string]$ProjectId, [Parameter(Mandatory=$true)][string]$Service, [Parameter(Mandatory=$true)][string]$Region, [Parameter(Mandatory=$true)][string]$Bucket, [Parameter(Mandatory=$true)][string]$JwtIssuer, [Parameter(Mandatory=$true)][string]$JwtAudience, [string]$SessionSecretName="session-secret")\n$ErrorActionPreference = "Stop"\ngcloud config set project $ProjectId\ngcloud run deploy $Service --source backend --region $Region --service-account "$Service@$ProjectId.iam.gserviceaccount.com" --set-env-vars "FIREBASE_PROJECT_ID=$ProjectId,GCP_STORAGE_BUCKET=$Bucket,JWT_ISSUER=$JwtIssuer,JWT_AUDIENCE=$JwtAudience" --set-secrets "SESSION_SECRET=$SessionSecretName:latest"\n',
      'scripts/deploy-cloud-run.sh':
        '#!/usr/bin/env bash\nset -euo pipefail\n: "${PROJECT_ID:?}" "${SERVICE:?}" "${REGION:?}" "${GCP_STORAGE_BUCKET:?}" "${JWT_ISSUER:?}" "${JWT_AUDIENCE:?}"\nSESSION_SECRET_NAME="${SESSION_SECRET_NAME:-session-secret}"\ngcloud config set project "$PROJECT_ID"\ngcloud run deploy "$SERVICE" --source backend --region "$REGION" --service-account "$SERVICE@$PROJECT_ID.iam.gserviceaccount.com" --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT_ID,GCP_STORAGE_BUCKET=$GCP_STORAGE_BUCKET,JWT_ISSUER=$JWT_ISSUER,JWT_AUDIENCE=$JWT_AUDIENCE" --set-secrets "SESSION_SECRET=$SESSION_SECRET_NAME:latest"\n',
      'backend/README.md':
        '# Go API\n\nRun `go mod tidy` then `go run ./cmd/api`. `internal/` separates config, domain, Firestore access, storage, auth, and routes.\n',
    },
    readmeSections: [
      '## Go API\n\nThe Go API uses focused `internal/` packages: handlers do not contain persistence code and provider SDKs are isolated behind repositories/adapters.',
    ],
  };
}
