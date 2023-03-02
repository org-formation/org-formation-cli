terraform {
  backend "s3" {
  }
}

provider "aws" {}

variable "tfvarforbucketname" {}

resource "aws_s3_bucket" "b" {
  bucket = var.tfvarforbucketname

  tags = {
    ManagedBy = "Terraform"
    DeployedWith = "org-formation"
  }
}