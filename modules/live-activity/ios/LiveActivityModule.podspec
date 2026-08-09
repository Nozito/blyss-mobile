require 'json'

package = JSON.parse(File.read(File.join(__dir__, '../package.json')))

Pod::Spec.new do |s|
  s.name           = 'LiveActivityModule'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'Blyss'
  s.homepage       = 'https://blyssapp.fr'
  # Matches the main app target's deployment target (15.1) — CocoaPods
  # requires a pod's minimum to be <= the target's, or it's skipped entirely
  # ("doesn't support iOS platform"). The ActivityKit-specific code inside is
  # already gated at runtime with @available(iOS 16.2/17.2, *) checks.
  s.platforms      = { ios: '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift}'
end
