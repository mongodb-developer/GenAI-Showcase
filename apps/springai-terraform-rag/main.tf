terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
    }
  }
  required_version = ">= 0.13"
}

provider "mongodbatlas" {
  public_key  = var.public_key
  private_key = var.private_key
}

resource "mongodbatlas_project" "rag_project" {
  name   = var.project_name
  org_id = var.atlas_org_id
}

resource "mongodbatlas_advanced_cluster" "rag_cluster" {
  project_id   = mongodbatlas_project.rag_project.id
  name         = var.cluster_name
  cluster_type = "REPLICASET"

  replication_specs {
    region_configs {
      electable_specs {
        instance_size = "M10"
        node_count    = 3
      }
      provider_name = "AWS"
      region_name   = "EU_WEST_1"
      priority      = 7
    }
  }
}

resource "mongodbatlas_project_ip_access_list" "ip_list" {
  project_id = mongodbatlas_project.rag_project.id
  ip_address = var.ip_address
}

resource "mongodbatlas_database_user" "db_user" {
  username           = var.db_username
  password           = var.db_password
  project_id         = mongodbatlas_project.rag_project.id
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = "rag"
  }
}

resource "mongodbatlas_search_index" "vector_search" {
  name   = "search-index"  
  project_id = mongodbatlas_project.rag_project.id
  cluster_name = mongodbatlas_advanced_cluster.rag_cluster.name
  type = "vectorSearch"
  database = "rag"
  collection_name = "vector_store"
  fields = <<-EOF
    [{
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
    }]
    EOF
}