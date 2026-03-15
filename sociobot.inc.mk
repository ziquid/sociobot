# sociobot.inc.mk

FEATURES := bun local-install

ZDS_AI_ROOT ?= /usr/local/share/zds-ai
SKILLZ_ROOT := $(ZDS_AI_ROOT)/skillz
SKILLZ_VENDOR := $(SKILLZ_ROOT)/sociobot

# Find all subdirectories that contain a Mzkefile
# MZK_DIRS := $(dir $(wildcard */Mzkefile))

# Remove trailing slash
# MZK_DIRS := $(patsubst %/,%,$(MZK_DIRS))

# Generate install entries
LOCAL_INSTALL_ENTRIES := \
    src/skillz/man/*.man.md:$(SKILLZ_VENDOR)/man:0644

ALL_TARGET := pack

.PHONY: copy
copy: ## copy to $(BUN_PACKAGE_NAME_STRIPPED).tgz and zds-ai project
	cp $(BUN_PACKAGE_TARBALL) $(BUN_PACKAGE_NAME_STRIPPED).tgz
	cp $(BUN_PACKAGE_NAME_STRIPPED).tgz ~/sca/zds-ai

.PHONY: pack-and-copy
pack-and-copy pac pc: pack-quiet copy ## package quietly, copy to $(BUN_PACKAGE_NAME_STRIPPED).tgz and zds-ai project
	@:

.PHONY: prigc
prigc: pqrig copy ## build, pack quietly, reinstall globally, and copy
	@:
