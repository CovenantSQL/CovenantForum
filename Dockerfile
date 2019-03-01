FROM golang:alpine as builder
RUN apk add --no-cache ca-certificates
WORKDIR /go/src/github.com/CovenantSQL/CovenantForum
COPY . .
RUN go generate ./static
RUN CGO_ENABLED=0 go install ./cmd/forum

FROM alpine
WORKDIR /app
COPY --from=builder /go/bin/forum /app/forum
COPY --from=builder /etc/ssl/certs /etc/ssl/certs
ENTRYPOINT ["/app/forum"]
