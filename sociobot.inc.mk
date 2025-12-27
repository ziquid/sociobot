FEATURES := npm

ALL_TARGET := pack

.PHONY: pack-and-copy
pack-and-copy pac pc: pack ## package, copy to $(NPM_PACKAGE_NAME_STRIPPED).tgz and zds-ai project
	cp $(NPM_PACKAGE_TARBALL) $(NPM_PACKAGE_NAME_STRIPPED).tgz
	cp $(NPM_PACKAGE_NAME_STRIPPED).tgz ~/sca/zds-ai
