Pod::Spec.new do |s|
  s.name           = 'JulyTls'
  s.version        = '1.0.0'
  s.summary        = 'Per-host certificate trust for the oven: a home CA, or opt-in no checks.'
  s.description    = 'Lets fetch and WebSocket reach a june-local server whose home certificate the phone does not trust.'
  s.author         = 'Project July'
  s.homepage       = 'https://github.com/prj-july'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
