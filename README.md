# clawdlink

A tiny gateway to gateway messaging helper for Clawd instances running on the same machine.

Goal: let one Clawd instance deliver a deliberately non actionable message to the other instance, which then forwards it to its owner via its normal channel.

This repo intentionally does not store any tokens. Tokens should live in each instance's local config.
