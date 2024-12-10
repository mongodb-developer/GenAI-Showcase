variable "atlas_org_id" {
  description = "MongoDB Atlas Organization ID"
  type        = string
}

variable "public_key" {
  description = "Public API key for MongoDB Atlas"
  type        = string
}

variable "private_key" {
  description = "Private API key for MongoDB Atlas"
  type        = string
}

variable "cluster_name" {
  description = "Name of the MongoDB Atlas cluster"
  type        = string
  default     = "RagCluster"
}

variable "project_name" {
  description = "Name of the MongoDB Atlas project"
  type        = string
  default     = "RAGProject"
}

variable "db_username" {
  description = "MongoDB database username"
  type        = string
}

variable "db_password" {
  description = "MongoDB database password"
  type        = string
}

variable "ip_address" {
  description = "IP address to whitelist"
  type        = string
  default     = "196.000.0.000"
}
